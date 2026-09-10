import { createHash } from "node:crypto";
import * as oauth from "oauth4webapi";

export interface OAuthIdentity {
  provider: "GOOGLE" | "FACEBOOK";
  subject: string;
  email: string | null;
  emailVerified: boolean;
  fullName: string;
}

export interface OAuthProviderAdapter {
  provider: "GOOGLE" | "FACEBOOK";
  authorizationUrl(input: { state: string; redirectUri: string; pkceVerifier: string }): Promise<string>;
  exchange(input: { code: string; state: string; redirectUri: string; pkceVerifier: string }): Promise<OAuthIdentity>;
}

type FetchImplementation = typeof fetch;
type GoogleOAuthCredentials = {
  clientId: string;
  clientSecret: string;
};

const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUER = "https://accounts.google.com";
const REQUEST_TIMEOUT_MS = 10_000;

const GOOGLE_AUTHORIZATION_SERVER: oauth.AuthorizationServer = {
  issuer: GOOGLE_ISSUER,
  authorization_endpoint: GOOGLE_AUTHORIZATION_ENDPOINT,
  token_endpoint: GOOGLE_TOKEN_ENDPOINT,
  jwks_uri: GOOGLE_JWKS_URI,
  id_token_signing_alg_values_supported: ["RS256"],
};

export function createGoogleOAuthProvider(
  credentials: GoogleOAuthCredentials,
  fetchImpl: FetchImplementation = globalThis.fetch,
): OAuthProviderAdapter {
  if (!credentials.clientId.trim() || !credentials.clientSecret.trim()) {
    throw new Error("Google OAuth client credentials are required.");
  }

  const client: oauth.Client = {
    client_id: credentials.clientId,
    id_token_signed_response_alg: "RS256",
  };
  if (typeof fetchImpl !== "function") throw new Error("Fetch is required for Google OAuth.");

  const requestOptions = {
    [oauth.customFetch]: createGoogleFetch(fetchImpl),
  };

  return {
    provider: "GOOGLE",

    async authorizationUrl(input) {
      assertAuthorizationInput(input);
      const codeChallenge = await oauth.calculatePKCECodeChallenge(input.pkceVerifier);
      const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
      url.searchParams.set("client_id", client.client_id);
      url.searchParams.set("redirect_uri", input.redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("state", input.state);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      // The nonce is deterministic from the transaction-bound PKCE verifier, so it need not be stored separately.
      url.searchParams.set("nonce", codeChallenge);
      return url.href;
    },

    async exchange(input) {
      assertExchangeInput(input);
      try {
        const parameters = oauth.validateAuthResponse(
          GOOGLE_AUTHORIZATION_SERVER,
          client,
          new URLSearchParams({ code: input.code, state: input.state }),
          input.state,
        );
        const response = await oauth.authorizationCodeGrantRequest(
          GOOGLE_AUTHORIZATION_SERVER,
          client,
          oauth.ClientSecretPost(credentials.clientSecret),
          parameters,
          input.redirectUri,
          input.pkceVerifier,
          requestOptions,
        );
        const tokenResponse = await oauth.processAuthorizationCodeResponse(
          GOOGLE_AUTHORIZATION_SERVER,
          client,
          response,
          { expectedNonce: await oauth.calculatePKCECodeChallenge(input.pkceVerifier), requireIdToken: true },
        );
        await oauth.validateApplicationLevelSignature(GOOGLE_AUTHORIZATION_SERVER, response, requestOptions);
        const claims = oauth.getValidatedIdTokenClaims(tokenResponse);
        if (!claims) throw new Error("Missing ID token.");
        return toIdentity(claims);
      } catch {
        // Provider protocol failures may contain tokens or provider diagnostics; never propagate them.
        throw new Error("Google OAuth exchange failed.");
      }
    },
  };
}

function createGoogleFetch(fetchImpl: FetchImplementation) {
  return async (url: string, options: RequestInit) => {
    if (url !== GOOGLE_TOKEN_ENDPOINT && url !== GOOGLE_JWKS_URI) {
      throw new Error("Unexpected Google OAuth endpoint.");
    }
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    return fetchImpl(url, { ...options, redirect: "error", signal });
  };
}

function assertAuthorizationInput(input: { state: string; redirectUri: string; pkceVerifier: string }) {
  if (!input.state || !input.pkceVerifier || !isExactHttpsUri(input.redirectUri)) {
    throw new Error("Invalid Google OAuth authorization request.");
  }
}

function assertExchangeInput(input: { code: string; state: string; redirectUri: string; pkceVerifier: string }) {
  if (!input.code || !input.state || !input.pkceVerifier || !isExactHttpsUri(input.redirectUri)) {
    throw new Error("Google OAuth exchange failed.");
  }
}

function isExactHttpsUri(value: string) {
  try {
    const url = new URL(value);
    const isLoopbackHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (url.protocol === "https:" || isLoopbackHttp) &&
      !url.username && !url.password && !url.search && !url.hash && url.href === value;
  } catch {
    return false;
  }
}

function toIdentity(claims: oauth.IDToken): OAuthIdentity {
  if (!claims.sub || typeof claims.sub !== "string" || claims.sub.length > 255) throw new Error("Invalid ID token subject.");
  const email = typeof claims.email === "string" && isEmail(claims.email) ? claims.email.toLowerCase() : null;
  const name = typeof claims.name === "string" ? claims.name.trim().slice(0, 120) : "";
  return {
    provider: "GOOGLE",
    subject: claims.sub,
    email,
    emailVerified: email !== null && claims.email_verified === true,
    fullName: name || email || "Google customer",
  };
}

function isEmail(value: string) {
  return value.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function googleNonceForVerifier(pkceVerifier: string) {
  return createHash("sha256").update(pkceVerifier).digest("base64url");
}
