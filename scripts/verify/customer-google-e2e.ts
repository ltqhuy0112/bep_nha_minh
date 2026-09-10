import "dotenv/config";
import assert from "node:assert/strict";
import { createSign, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import pg from "pg";
import { runner } from "node-pg-migrate";
import { createCustomerAuthHandler } from "../../apps/api/src/features/customer-auth/http";
import { createGoogleOAuthProvider, googleNonceForVerifier } from "../../apps/api/src/features/customer-auth/oauth-provider";
import { createApiServer } from "../../apps/api/src/runtime/http-server";

const baseUrl = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh");
const databaseName = `bep_google_e2e_${randomUUID().replaceAll("-", "")}`;
const databaseUrl = new URL(baseUrl);
databaseUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: baseUrl.toString() });
const pool = new pg.Pool({ connectionString: databaseUrl.toString(), max: 6 });
const clientId = "google-e2e-client.apps.exampleusercontent.com";
const clientSecret = "google-e2e-secret";
const issuer = "https://accounts.google.com";
const issuedAt = Math.floor(Date.now() / 1000);
const keyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...keyPair.publicKey.export({ format: "jwk" }), kid: "google-e2e-key", use: "sig", alg: "RS256" };

let created = false;
let checks = 0;
let tokenRequests = 0;

function check(condition: unknown, message: string) {
  assert.ok(condition, message);
  checks += 1;
}

async function main() {
  assert.match(databaseName, /^bep_google_e2e_[a-f0-9]{32}$/);
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  await runner({ databaseUrl: databaseUrl.toString(), dir: path.resolve("migrations"), direction: "up",
    migrationsTable: "pgmigrations", count: Infinity, log: () => undefined });

  const port = await reserveLoopbackPort();
  const origin = `http://127.0.0.1:${port}`;
  const callbackUri = `${origin}/api/v1/customer-auth/oauth/google/callback`;
  const config = {
    enabled: true,
    publicWebUrl: origin,
    secureCookies: false,
    email: null,
    rateLimit: { key: randomBytes(32).toString("base64"), limit: 100, windowSeconds: 60 },
    oauth: {
      encryptionKey: randomBytes(32).toString("base64"),
      providers: { GOOGLE: { clientId, clientSecret, redirectUri: callbackUri } },
    },
  };
  const adapter = createGoogleOAuthProvider({ clientId, clientSecret }, mockGoogleFetch);
  const server = createApiServer({ customerAuthHandler: createCustomerAuthHandler(pool, config, { GOOGLE: adapter }) });
  server.listen(port, "127.0.0.1");
  await once(server, "listening");

  try {
    const first = await start(origin);
    check(first.google.searchParams.get("redirect_uri") === callbackUri, "start uses exact loopback callback URI");
    check(first.google.searchParams.get("code_challenge_method") === "S256", "start delegates mandatory S256 PKCE");
    const firstCallback = await callback(origin, first, "e2e-success");
    check(firstCallback.status === 303, "callback completes with a redirect");
    check(firstCallback.headers.get("location") === `${origin}/en/account`, "callback preserves transaction locale in fixed account route");
    const firstSession = cookie(firstCallback, "bnm_customer_session");
    check(Boolean(firstSession), "callback issues a customer session cookie");
    const session = await fetch(`${origin}/api/v1/customer-auth/session`, { headers: { cookie: firstSession! } });
    check(session.status === 200, "issued session authenticates through actual HTTP handler");
    const body = await session.json() as { data: { account: { email: string; emailVerified: boolean } } };
    check(body.data.account.email === "customer@example.test", "session resolves signed Google email");
    check(body.data.account.emailVerified, "verified Google email is reflected on customer account");

    const duplicate = await callback(origin, first, "e2e-success");
    check(duplicate.status === 400, "a consumed state cannot be replayed through HTTP");
    check(tokenRequests === 1, "replayed state never reaches Google token exchange");

    const binding = await start(origin);
    const missingBinding = await fetch(`${origin}/api/v1/customer-auth/oauth/google/callback?state=${encodeURIComponent(binding.state)}&code=e2e-success`, { redirect: "manual" });
    check(missingBinding.status === 400, "callback requires the browser-bound transaction cookie");
    const boundCallback = await callback(origin, binding, "e2e-success");
    check(boundCallback.status === 303, "valid binding can still complete its unconsumed transaction");

    const collision = await start(origin);
    const collisionCallback = await callback(origin, collision, "e2e-email-collision");
    check(collisionCallback.status === 303 && collisionCallback.headers.get("location") === `${origin}/en/account?oauth=error`,
      "a different Google subject with an existing email is not auto-linked");
    const totals = await pool.query<{ customers: number; accounts: number; identities: number; sessions: number; consumed: number }>(`
      SELECT (SELECT count(*)::int FROM customers) AS customers,
        (SELECT count(*)::int FROM customer_accounts) AS accounts,
        (SELECT count(*)::int FROM customer_identities) AS identities,
        (SELECT count(*)::int FROM customer_sessions) AS sessions,
        (SELECT count(*)::int FROM customer_oauth_transactions WHERE consumed_at IS NOT NULL) AS consumed
    `);
    check(totals.rows[0].customers === 1 && totals.rows[0].accounts === 1, "OAuth email collision creates no customer or account");
    check(totals.rows[0].identities === 1, "only the original provider subject is linked");
    check(totals.rows[0].sessions === 2, "successful callbacks create customer sessions");
    check(totals.rows[0].consumed === 3, "each provider callback attempt consumes state exactly once after valid binding");
    console.log(`Customer Google OAuth E2E passed: ${checks} checks; isolated PostgreSQL, actual HTTP handler, signed Google JWKS transport, no live credentials.`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function start(origin: string) {
  const response = await fetch(`${origin}/api/v1/customer-auth/oauth/google/start?locale=en`, { redirect: "manual" });
  assert.equal(response.status, 302, "OAuth start must redirect to Google");
  const location = response.headers.get("location");
  const binding = cookie(response, "bnm_customer_oauth_google");
  assert(location && binding, "OAuth start must provide Google redirect and browser binding");
  const google = new URL(location);
  const state = google.searchParams.get("state");
  assert(state, "Google authorization redirect must include state");
  return { google, state, binding };
}

async function callback(origin: string, transaction: { state: string; binding: string }, code: string) {
  return fetch(`${origin}/api/v1/customer-auth/oauth/google/callback?state=${encodeURIComponent(transaction.state)}&code=${encodeURIComponent(code)}`, {
    headers: { cookie: transaction.binding },
    redirect: "manual",
  });
}

async function mockGoogleFetch(url: string | URL | Request, options?: RequestInit) {
  const endpoint = String(url);
  if (endpoint === "https://oauth2.googleapis.com/token") {
    tokenRequests += 1;
    const form = new URLSearchParams(String(options?.body));
    check(form.get("client_id") === clientId, "adapter sends configured client id to Google token endpoint");
    check(form.get("client_secret") === clientSecret, "adapter sends configured client secret to Google token endpoint");
    check(form.get("redirect_uri")?.startsWith("http://127.0.0.1:"), "adapter preserves loopback redirect URI during exchange");
    check(form.get("code_verifier"), "adapter exchanges the transaction PKCE verifier");
    const subject = form.get("code") === "e2e-email-collision" ? "google-subject-collision" : "google-subject-e2e";
    return json({ access_token: "mock-access-token", token_type: "Bearer", id_token: signedIdToken(subject, form.get("code_verifier")!) });
  }
  if (endpoint === "https://www.googleapis.com/oauth2/v3/certs") return json({ keys: [jwk] });
  throw new Error("Unexpected mock Google request.");
}

function signedIdToken(subject: string, verifier: string) {
  const header = encode({ alg: "RS256", kid: "google-e2e-key", typ: "JWT" });
  const payload = encode({ iss: issuer, sub: subject, aud: clientId, exp: issuedAt + 300, iat: issuedAt,
    nonce: googleNonceForVerifier(verifier), email: "Customer@Example.Test", email_verified: true, name: "Google E2E Customer" });
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();
  return `${header}.${payload}.${signer.sign(keyPair.privateKey).toString("base64url")}`;
}

function cookie(response: Response, name: string) {
  const value = response.headers.get("set-cookie") ?? "";
  return value.match(new RegExp(`(?:^|,\\s*)(${name}=[^;]+)`))?.[1] ?? null;
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function json(value: unknown) {
  return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
}

async function reserveLoopbackPort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Customer Google OAuth E2E failed.");
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
  if (created) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  await admin.end();
});
