import assert from "node:assert/strict";
import { createSign, generateKeyPairSync } from "node:crypto";
import { createGoogleOAuthProvider, googleNonceForVerifier } from "../../apps/api/src/features/customer-auth/oauth-provider";

const clientId = "google-client-id.apps.exampleusercontent.com";
const clientSecret = "test-google-client-secret";
const redirectUri = "https://app.example.test/api/v1/customer-auth/oauth/google/callback";
const state = "state-for-google-provider-test";
const verifier = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-._~pk";
const now = Math.floor(Date.now() / 1000);
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = { ...keys.publicKey.export({ format: "jwk" }), kid: "test-google-key", use: "sig", alg: "RS256" };

let checks = 0;
function check(condition: unknown, message: string) {
  assert.ok(condition, message);
  checks += 1;
}

async function main() {
  const requests: Array<{ url: string; options: RequestInit }> = [];
  const provider = createGoogleOAuthProvider(
    { clientId, clientSecret },
    async (url, options = {}) => {
      const requestUrl = String(url);
      requests.push({ url: requestUrl, options });
      if (requestUrl === "https://oauth2.googleapis.com/token") {
        const body = new URLSearchParams(String(options.body));
        check(body.get("client_id") === clientId, "token request includes client id");
        check(body.get("client_secret") === clientSecret, "token request uses configured secret");
        check(body.get("code_verifier") === verifier, "token request uses PKCE verifier");
        return json({ access_token: "access-token", token_type: "Bearer", id_token: signedIdToken() });
      }
      if (requestUrl === "https://www.googleapis.com/oauth2/v3/certs") return json({ keys: [publicJwk] });
      throw new Error(`Unexpected request ${requestUrl}`);
    },
  );

  const authorizationUrl = new URL(await provider.authorizationUrl({ state, redirectUri, pkceVerifier: verifier }));
  check(authorizationUrl.origin === "https://accounts.google.com", "authorization uses fixed Google endpoint");
  check(authorizationUrl.searchParams.get("scope") === "openid email profile", "authorization uses OIDC profile scopes");
  check(authorizationUrl.searchParams.get("code_challenge_method") === "S256", "PKCE S256 is mandatory");
  check(authorizationUrl.searchParams.get("nonce") === googleNonceForVerifier(verifier), "nonce is transaction-bound to verifier");
  check(authorizationUrl.searchParams.get("redirect_uri") === redirectUri, "authorization preserves exact callback");
  for (const localCallback of [
    "http://localhost:3001/api/v1/customer-auth/oauth/google/callback",
    "http://127.0.0.1:3001/api/v1/customer-auth/oauth/google/callback",
    "http://[::1]:3001/api/v1/customer-auth/oauth/google/callback",
  ]) {
    const local = new URL(await provider.authorizationUrl({ state, redirectUri: localCallback, pkceVerifier: verifier }));
    check(local.searchParams.get("redirect_uri") === localCallback, "allows exact local loopback HTTP callback");
  }
  await assert.rejects(
    () => provider.authorizationUrl({ state, redirectUri: "http://shop.example/api/customer-auth/oauth/google/callback", pkceVerifier: verifier }),
    /Invalid Google OAuth authorization request/,
  );
  checks += 1;

  const identity = await provider.exchange({ code: "valid-code", state, redirectUri, pkceVerifier: verifier });
  check(identity.provider === "GOOGLE", "returns Google identity");
  check(identity.subject === "google-subject-123", "returns validated subject");
  check(identity.email === "customer@example.test", "normalizes validated email");
  check(identity.emailVerified, "reads email_verified from validated ID token");
  check(identity.fullName === "Customer Example", "returns profile name");
  check(requests.every((request) => request.options.redirect === "error"), "provider requests reject redirects");
  check(requests.every((request) => request.options.signal instanceof AbortSignal), "provider requests enforce timeout signal");

  await rejectsExchange("bad signature", signedIdToken({ signWithWrongKey: true }));
  await rejectsExchange("wrong audience", signedIdToken({ aud: "another-client" }));
  await rejectsExchange("wrong issuer", signedIdToken({ iss: "https://issuer.example.test" }));
  await rejectsExchange("wrong nonce", signedIdToken({ nonce: "wrong-nonce" }));
  await rejectsExchange("expired token", signedIdToken({ exp: now - 120 }));
  await rejectsExchange("provider token error", null, 400);
  console.log(`customer OAuth provider verification passed: ${checks} checks; signed JWT/JWKS mock only, no live Google credentials.`);
}

async function rejectsExchange(label: string, idToken: string | null, tokenStatus = 200) {
  const provider = createGoogleOAuthProvider(
    { clientId, clientSecret },
    async (url) => {
      if (String(url) === "https://oauth2.googleapis.com/token") {
        return tokenStatus === 200
          ? json({ access_token: "access-token", token_type: "Bearer", id_token: idToken })
          : json({ error: "invalid_grant", error_description: "provider diagnostic must not leak" }, tokenStatus);
      }
      if (String(url) === "https://www.googleapis.com/oauth2/v3/certs") return json({ keys: [publicJwk] });
      throw new Error("unexpected test endpoint");
    },
  );
  await assert.rejects(
    () => provider.exchange({ code: "test-code", state, redirectUri, pkceVerifier: verifier }),
    (error: unknown) => error instanceof Error && error.message === "Google OAuth exchange failed.",
    label,
  );
  checks += 1;
}

function signedIdToken(overrides: { aud?: string; iss?: string; nonce?: string; exp?: number; signWithWrongKey?: boolean } = {}) {
  const header = base64Url(JSON.stringify({ alg: "RS256", kid: "test-google-key", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: overrides.iss ?? "https://accounts.google.com",
    sub: "google-subject-123",
    aud: overrides.aud ?? clientId,
    exp: overrides.exp ?? now + 300,
    iat: now,
    nonce: overrides.nonce ?? googleNonceForVerifier(verifier),
    email: "Customer@Example.Test",
    email_verified: true,
    name: "Customer Example",
  }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();
  const privateKey = overrides.signWithWrongKey
    ? generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey
    : keys.privateKey;
  return `${header}.${payload}.${signer.sign(privateKey).toString("base64url")}`;
}

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "OAuth provider verification failed.");
  process.exitCode = 1;
});
