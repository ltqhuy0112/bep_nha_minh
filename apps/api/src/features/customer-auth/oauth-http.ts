import type { IncomingMessage, ServerResponse } from "node:http";
import type { Pool } from "pg";
import type { CustomerAuthConfig } from "./config";
import { OAuthTransactionStore, type OAuthProvider } from "./oauth-transactions";
import { createGoogleOAuthProvider, type OAuthProviderAdapter } from "./oauth-provider";
import { createFacebookOAuthProvider } from "./facebook-provider";
import { SharedAuthLimiter } from "./rate-limit";
import { AuthError, newToken, sessionCookie, TOKEN_PATTERN, tokenHash } from "./security";
import type { CustomerAuthService } from "./service";

export function createOAuthHandler(pool: Pool, config: CustomerAuthConfig, service: CustomerAuthService,
  injected?: Partial<Record<OAuthProvider, OAuthProviderAdapter>>) {
  const settings = config.oauth;
  const providers: Partial<Record<OAuthProvider, OAuthProviderAdapter>> = injected ?? {};
  if (!injected && settings?.providers.GOOGLE) providers.GOOGLE = createGoogleOAuthProvider(settings.providers.GOOGLE);
  if (!injected && settings?.providers.FACEBOOK) providers.FACEBOOK = createFacebookOAuthProvider({ ...settings.providers.FACEBOOK, graphVersion: settings.providers.FACEBOOK.graphVersion ?? "" });
  const store = settings ? new OAuthTransactionStore(pool, { encryptionKey: settings.encryptionKey,
    redirectUris: Object.fromEntries(Object.entries(settings.providers).map(([key, value]) => [key, value.redirectUri])) }) : null;
  const limiter = config.rateLimit ? new SharedAuthLimiter(pool, config.rateLimit) : null;
  const available = { google: Boolean(config.enabled && store && providers.GOOGLE), facebook: Boolean(config.enabled && store && providers.FACEBOOK) };

  return {
    available,
    async handle(request: IncomingMessage, response: ServerResponse, url: URL) {
      const match = /^\/api\/v1\/customer-auth\/oauth\/(google|facebook)\/(start|callback)$/.exec(url.pathname);
      if (!match) return false;
      if (request.method !== "GET") { response.setHeader("Allow", "GET"); throw new AuthError(405, "METHOD_NOT_ALLOWED", "Method not allowed."); }
      const providerName = match[1].toUpperCase() as OAuthProvider;
      const adapter = providers[providerName];
      if (!config.enabled || !store || !limiter || !adapter) throw new AuthError(503, "OAUTH_NOT_ENABLED", "Provider sign-in is unavailable.");
      if (url.search.length > 8192) throw invalidCallback();
      if (match[2] === "start") {
        if (request.headers["sec-fetch-site"] === "cross-site" || (request.headers.origin && request.headers.origin !== config.publicWebUrl)) {
          throw new AuthError(403, "ORIGIN_NOT_ALLOWED", "Request origin is not allowed.");
        }
        assertQuery(url, ["locale"]);
        const locale = url.searchParams.get("locale") ?? "vi";
        if (locale !== "vi" && locale !== "en") throw invalidCallback();
        await limiter.enforce("OAUTH_START", request.socket.remoteAddress ?? "unknown");
        const pkceVerifier = newToken();
        const transaction = await store.create({ provider: providerName, locale, pkceVerifier });
        const location = await adapter.authorizationUrl({ state: transaction.state, redirectUri: transaction.redirectUri, pkceVerifier });
        response.setHeader("Set-Cookie", bindingCookie(providerName, transaction.browserBinding, config.secureCookies));
        redirect(response, 302, location);
        return true;
      }
      assertQuery(url, ["state", "code", "error", "scope", "authuser", "prompt", "iss", "error_reason", "error_description"]);
      const state = url.searchParams.get("state") ?? "";
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      if (!TOKEN_PATTERN.test(state) || Boolean(code) === Boolean(error) || (code && code.length > 4096) || (error && error.length > 128)) throw invalidCallback();
      const binding = readBinding(request.headers.cookie, providerName, config.secureCookies);
      if (!binding) throw invalidCallback();
      await limiter.enforce("OAUTH_CALLBACK", tokenHash(binding));
      const transaction = await store.consume({ provider: providerName, state, browserBinding: binding });
      response.setHeader("Set-Cookie", bindingCookie(providerName, null, config.secureCookies));
      const accountUrl = `${config.publicWebUrl}/${transaction.locale}/account`;
      if (error) { redirect(response, 303, `${accountUrl}?oauth=error`); return true; }
      try {
        if (!transaction.pkceVerifier) throw invalidCallback();
        const identity = await adapter.exchange({ code: code!, state, redirectUri: transaction.redirectUri, pkceVerifier: transaction.pkceVerifier });
        if (identity.provider !== providerName) throw invalidCallback();
        const result = await service.loginOAuth(identity);
        response.setHeader("Set-Cookie", [bindingCookie(providerName, null, config.secureCookies), sessionCookie(result.token, config.secureCookies)]);
        redirect(response, 303, accountUrl);
      } catch {
        // Tokens/provider errors never enter the redirect, response body or logs.
        redirect(response, 303, `${accountUrl}?oauth=error`);
      }
      return true;
    }
  };
}

function assertQuery(url: URL, allowed: string[]) {
  for (const key of url.searchParams.keys()) if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) throw invalidCallback();
}
function bindingName(provider: OAuthProvider, secure: boolean) {
  return `${secure ? "__Host-" : ""}bnm_customer_oauth_${provider.toLowerCase()}`;
}
function bindingCookie(provider: OAuthProvider, value: string | null, secure: boolean) {
  return `${bindingName(provider, secure)}=${value ?? ""}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${value ? 600 : 0}${secure ? "; Secure" : ""}`;
}
function readBinding(cookie: string | undefined, provider: OAuthProvider, secure: boolean) {
  const name = `${bindingName(provider, secure)}=`;
  const matches = (cookie ?? "").split(";").map((part) => part.trim()).filter((part) => part.startsWith(name));
  const value = matches.length === 1 ? matches[0].slice(name.length) : "";
  return TOKEN_PATTERN.test(value) ? value : null;
}
function redirect(response: ServerResponse, status: number, location: string) {
  response.writeHead(status, { location, "cache-control": "no-store", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff" });
  response.end();
}
const invalidCallback = () => new AuthError(400, "INVALID_OAUTH_TRANSACTION", "OAuth transaction is invalid or expired.");
