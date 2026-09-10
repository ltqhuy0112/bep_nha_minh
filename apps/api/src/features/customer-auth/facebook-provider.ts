import { createHmac } from "node:crypto";
import * as oauth from "oauth4webapi";
import type { OAuthIdentity, OAuthProviderAdapter } from "./oauth-provider";

type FacebookOAuthCredentials = {
  clientId: string;
  clientSecret: string;
  graphVersion: string;
};
type FetchImplementation = typeof fetch;
type FacebookTokenResponse = { access_token?: unknown; expires_in?: unknown; token_type?: unknown };
type FacebookDebugResponse = { data?: { is_valid?: unknown; app_id?: unknown; user_id?: unknown; expires_at?: unknown; data_access_expires_at?: unknown } };
type FacebookProfileResponse = { id?: unknown; name?: unknown; email?: unknown };

const FACEBOOK_ORIGIN = "https://www.facebook.com";
const GRAPH_ORIGIN = "https://graph.facebook.com";
const REQUEST_TIMEOUT_MS = 10_000;

export function createFacebookOAuthProvider(
  credentials: FacebookOAuthCredentials,
  fetchImpl: FetchImplementation = globalThis.fetch,
): OAuthProviderAdapter {
  if (!credentials.clientId.trim() || !credentials.clientSecret.trim() || !/^v\d+\.\d+$/.test(credentials.graphVersion)) {
    throw new Error("Facebook OAuth credentials and graph version are required.");
  }
  if (typeof fetchImpl !== "function") throw new Error("Fetch is required for Facebook OAuth.");

  const version = credentials.graphVersion;
  const authorizationEndpoint = `${FACEBOOK_ORIGIN}/${version}/dialog/oauth`;
  const tokenEndpoint = `${GRAPH_ORIGIN}/${version}/oauth/access_token`;
  const debugEndpoint = `${GRAPH_ORIGIN}/${version}/debug_token`;
  const profileEndpoint = `${GRAPH_ORIGIN}/${version}/me`;
  const client: oauth.Client = { client_id: credentials.clientId };
  const authorizationServer: oauth.AuthorizationServer = { issuer: FACEBOOK_ORIGIN, authorization_endpoint: authorizationEndpoint };
  const request = createFacebookFetch(fetchImpl, new Set([tokenEndpoint, debugEndpoint, profileEndpoint]));

  return {
    provider: "FACEBOOK",

    async authorizationUrl(input) {
      assertAuthorizationInput(input);
      const url = new URL(authorizationEndpoint);
      url.searchParams.set("client_id", client.client_id);
      url.searchParams.set("redirect_uri", input.redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "public_profile");
      url.searchParams.set("state", input.state);
      // Meta's documented server-side code flow does not document PKCE support for this endpoint.
      return url.href;
    },

    async exchange(input) {
      assertExchangeInput(input);
      try {
        oauth.validateAuthResponse(authorizationServer, client, new URLSearchParams({ code: input.code, state: input.state }), input.state);
        const tokenUrl = new URL(tokenEndpoint);
        tokenUrl.searchParams.set("client_id", credentials.clientId);
        tokenUrl.searchParams.set("client_secret", credentials.clientSecret);
        tokenUrl.searchParams.set("redirect_uri", input.redirectUri);
        tokenUrl.searchParams.set("code", input.code);
        const token = await json<FacebookTokenResponse>(await request(tokenUrl));
        const accessToken = nonEmptyString(token.access_token, 4096);
        if (!accessToken) throw new Error("Invalid Facebook access token response.");

        const appAccessToken = `${credentials.clientId}|${credentials.clientSecret}`;
        const debugUrl = new URL(debugEndpoint);
        // Meta's debug endpoint requires these token query parameters; this adapter never logs URLs.
        debugUrl.searchParams.set("input_token", accessToken);
        debugUrl.searchParams.set("access_token", appAccessToken);
        debugUrl.searchParams.set("appsecret_proof", appSecretProof(appAccessToken, credentials.clientSecret));
        const debug = await json<FacebookDebugResponse>(await request(debugUrl));
        const validated = validateDebug(debug.data, credentials.clientId);

        const profileUrl = new URL(profileEndpoint);
        profileUrl.searchParams.set("fields", "id,name");
        profileUrl.searchParams.set("appsecret_proof", appSecretProof(accessToken, credentials.clientSecret));
        const profile = await json<FacebookProfileResponse>(await request(profileUrl, { headers: { authorization: `Bearer ${accessToken}` } }));
        return toIdentity(profile, validated.userId);
      } catch {
        // Provider failures often include token or app diagnostics; never expose them outside this adapter.
        throw new Error("Facebook OAuth exchange failed.");
      }
    },
  };
}

function createFacebookFetch(fetchImpl: FetchImplementation, allowedEndpoints: Set<string>) {
  return async (url: URL, options: RequestInit = {}) => {
    if (!allowedEndpoints.has(url.origin + url.pathname)) throw new Error("Unexpected Facebook OAuth endpoint.");
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    return fetchImpl(url, { ...options, redirect: "error", signal });
  };
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok || !response.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new Error("Invalid Facebook provider response.");
  }
  return response.json() as Promise<T>;
}

function validateDebug(data: FacebookDebugResponse["data"], clientId: string) {
  const userId = nonEmptyString(data?.user_id, 255);
  const now = Math.floor(Date.now() / 1000);
  if (data?.is_valid !== true || data?.app_id !== clientId || !userId || !futureUnix(data?.expires_at, now) ||
      !futureUnix(data?.data_access_expires_at, now)) {
    throw new Error("Invalid Facebook token debug response.");
  }
  return { userId };
}

function toIdentity(profile: FacebookProfileResponse, expectedSubject: string): OAuthIdentity {
  const subject = nonEmptyString(profile.id, 255);
  const fullName = nonEmptyString(profile.name, 120);
  if (!subject || subject !== expectedSubject || !fullName) throw new Error("Invalid Facebook profile response.");
  const email = typeof profile.email === "string" && isEmail(profile.email) ? profile.email.toLowerCase() : null;
  return { provider: "FACEBOOK", subject, email, emailVerified: false, fullName };
}

function assertAuthorizationInput(input: { state: string; redirectUri: string; pkceVerifier: string }) {
  if (!input.state || !input.pkceVerifier || !isExactCallbackUri(input.redirectUri)) {
    throw new Error("Invalid Facebook OAuth authorization request.");
  }
}

function assertExchangeInput(input: { code: string; state: string; redirectUri: string; pkceVerifier: string }) {
  if (!input.code || !input.state || !input.pkceVerifier || !isExactCallbackUri(input.redirectUri)) {
    throw new Error("Facebook OAuth exchange failed.");
  }
}

function isExactCallbackUri(value: string) {
  try {
    const url = new URL(value);
    const isLoopbackHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (url.protocol === "https:" || isLoopbackHttp) &&
      !url.username && !url.password && !url.search && !url.hash && url.href === value;
  } catch {
    return false;
  }
}

function nonEmptyString(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum ? value.trim() : null;
}

function futureUnix(value: unknown, now: number) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > now;
}

function isEmail(value: string) {
  return value.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function facebookAppSecretProof(accessToken: string, clientSecret: string) {
  return createHmac("sha256", clientSecret).update(accessToken).digest("hex");
}

const appSecretProof = facebookAppSecretProof;
