import assert from "node:assert/strict";
import { createFacebookOAuthProvider, facebookAppSecretProof } from "../../apps/api/src/features/customer-auth/facebook-provider";

const clientId = "123456789012345";
const clientSecret = "facebook-test-secret";
const graphVersion = "v26.0";
const redirectUri = "https://app.example.test/api/v1/customer-auth/oauth/facebook/callback";
const state = "facebook-provider-state";
const verifier = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-._~pk";
const now = Math.floor(Date.now() / 1000);

let checks = 0;
function check(condition: unknown, message: string) {
  assert.ok(condition, message);
  checks += 1;
}

async function main() {
  const observed: Array<{ url: URL; options: RequestInit }> = [];
  const provider = createFacebookOAuthProvider({ clientId, clientSecret, graphVersion }, mockFetch({ observed }));
  const authorization = new URL(await provider.authorizationUrl({ state, redirectUri, pkceVerifier: verifier }));
  check(authorization.href.startsWith(`https://www.facebook.com/${graphVersion}/dialog/oauth?`), "uses explicit configured Graph version for Facebook authorization");
  check(authorization.searchParams.get("scope") === "public_profile", "requests only Facebook public profile scope");
  check(authorization.searchParams.get("state") === state, "forwards transaction state");
  check(authorization.searchParams.get("code_challenge") === null, "does not claim undocumented Facebook PKCE support");
  check(authorization.searchParams.get("redirect_uri") === redirectUri, "preserves exact registered callback URI");
  const loopback = new URL(await provider.authorizationUrl({ state, redirectUri: "http://127.0.0.1:3001/api/v1/customer-auth/oauth/facebook/callback", pkceVerifier: verifier }));
  check(loopback.searchParams.get("redirect_uri")?.startsWith("http://127.0.0.1:"), "allows exact local loopback HTTP callback");

  const identity = await provider.exchange({ code: "success", state, redirectUri, pkceVerifier: verifier });
  check(identity.provider === "FACEBOOK" && identity.subject === "facebook-user-42", "returns debug-validated Facebook subject");
  check(identity.email === "customer@example.test", "normalizes optional Facebook email");
  check(identity.emailVerified === false, "never infers Facebook email verification");
  check(identity.fullName === "Facebook Customer", "returns Facebook profile name");
  const token = observed.find((entry) => entry.url.pathname.endsWith("/oauth/access_token"))!;
  check(token.url.searchParams.get("client_secret") === clientSecret, "uses client secret only at Facebook token endpoint");
  const debug = observed.find((entry) => entry.url.pathname.endsWith("/debug_token"))!;
  check(debug.url.searchParams.get("access_token") === `${clientId}|${clientSecret}`, "debug endpoint uses app access token only where required");
  check(debug.url.searchParams.get("appsecret_proof") === facebookAppSecretProof(`${clientId}|${clientSecret}`, clientSecret), "debug request includes app access token proof");
  const me = observed.find((entry) => entry.url.pathname.endsWith("/me"))!;
  check(me.url.searchParams.get("fields") === "id,name", "does not request email in the profile lookup");
  check(me.options.headers instanceof Headers ? me.options.headers.get("authorization") === "Bearer user-access-token" :
    (me.options.headers as Record<string, string>).authorization === "Bearer user-access-token", "profile access token is sent in Authorization header");
  check(me.url.searchParams.get("appsecret_proof") === facebookAppSecretProof("user-access-token", clientSecret), "profile request includes user token proof");
  check(observed.every((entry) => entry.options.redirect === "error" && entry.options.signal instanceof AbortSignal), "provider requests reject redirects and set timeouts");

  await rejectsExchange("token denial", { tokenStatus: 400 });
  await rejectsExchange("wrong application", { appId: "other-app" });
  await rejectsExchange("expired token", { expiresAt: now - 1 });
  await rejectsExchange("expired data access", { dataAccessExpiresAt: now - 1 });
  await rejectsExchange("profile subject mismatch", { profileId: "different-user" });
  await rejectsExchange("missing profile name", { profileName: null });
  await rejectsExchange("network failure", { networkError: true });
  await rejectsExchange("timeout failure", { timeoutError: true });
  const noEmail = createFacebookOAuthProvider({ clientId, clientSecret, graphVersion }, mockFetch({ email: null }));
  const noEmailIdentity = await noEmail.exchange({ code: "no-email", state, redirectUri, pkceVerifier: verifier });
  check(noEmailIdentity.email === null && noEmailIdentity.emailVerified === false, "missing Facebook email is preserved without a false verification claim");
  await assert.rejects(
    () => provider.authorizationUrl({ state, redirectUri: "http://shop.example/callback", pkceVerifier: verifier }),
    /Invalid Facebook OAuth authorization request/,
  );
  checks += 1;
  console.log(`customer Facebook provider verification passed: ${checks} checks; mocked Meta transport only, no live credentials.`);
}

async function rejectsExchange(label: string, options: MockOptions) {
  const provider = createFacebookOAuthProvider({ clientId, clientSecret, graphVersion }, mockFetch(options));
  await assert.rejects(
    () => provider.exchange({ code: "failure", state, redirectUri, pkceVerifier: verifier }),
    (error: unknown) => error instanceof Error && error.message === "Facebook OAuth exchange failed.",
    label,
  );
  checks += 1;
}

type MockOptions = {
  observed?: Array<{ url: URL; options: RequestInit }>;
  tokenStatus?: number;
  appId?: string;
  expiresAt?: number;
  dataAccessExpiresAt?: number;
  profileId?: string;
  profileName?: string | null;
  email?: string | null;
  networkError?: boolean;
  timeoutError?: boolean;
};

function mockFetch(input: MockOptions): typeof fetch {
  return (async (url, options = {}) => {
    const parsed = new URL(String(url));
    input.observed?.push({ url: parsed, options });
    if (input.networkError) throw new Error("provider network diagnostic");
    if (input.timeoutError) throw new DOMException("provider timeout diagnostic", "TimeoutError");
    if (parsed.pathname.endsWith("/oauth/access_token")) {
      return input.tokenStatus ? json({ error: { message: "token provider diagnostics" } }, input.tokenStatus) : json({ access_token: "user-access-token", expires_in: 3600 });
    }
    if (parsed.pathname.endsWith("/debug_token")) {
      return json({ data: { is_valid: true, app_id: input.appId ?? clientId, user_id: "facebook-user-42",
        expires_at: input.expiresAt ?? now + 3600, data_access_expires_at: input.dataAccessExpiresAt ?? now + 7200 } });
    }
    if (parsed.pathname.endsWith("/me")) {
      return json({ id: input.profileId ?? "facebook-user-42", name: input.profileName === undefined ? "Facebook Customer" : input.profileName,
        ...(input.email === null ? {} : { email: input.email ?? "Customer@Example.Test" }) });
    }
    throw new Error("unexpected Facebook endpoint");
  }) as typeof fetch;
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Customer Facebook provider verification failed.");
  process.exitCode = 1;
});
