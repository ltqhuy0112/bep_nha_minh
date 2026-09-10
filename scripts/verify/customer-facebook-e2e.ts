import "dotenv/config";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { runner } from "node-pg-migrate";
import { createFacebookOAuthProvider, facebookAppSecretProof } from "../../apps/api/src/features/customer-auth/facebook-provider";
import { createCustomerAuthHandler } from "../../apps/api/src/features/customer-auth/http";
import { createApiServer } from "../../apps/api/src/runtime/http-server";

const baseUrl = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh");
const databaseName = `bep_facebook_e2e_${randomUUID().replaceAll("-", "")}`;
const databaseUrl = new URL(baseUrl);
databaseUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: baseUrl.toString() });
const pool = new pg.Pool({ connectionString: databaseUrl.toString(), max: 6 });
const clientId = "123456789012345";
const clientSecret = "facebook-e2e-secret";
const graphVersion = "v26.0";
const now = Math.floor(Date.now() / 1000);

let created = false;
let checks = 0;
let tokenRequests = 0;
function check(condition: unknown, message: string) {
  assert.ok(condition, message);
  checks += 1;
}

async function main() {
  assert.match(databaseName, /^bep_facebook_e2e_[a-f0-9]{32}$/);
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  await runner({ databaseUrl: databaseUrl.toString(), dir: path.resolve("migrations"), direction: "up",
    migrationsTable: "pgmigrations", count: Infinity, log: () => undefined });

  const port = await reserveLoopbackPort();
  const origin = `http://127.0.0.1:${port}`;
  const callbackUri = `${origin}/api/v1/customer-auth/oauth/facebook/callback`;
  const config = {
    enabled: true,
    publicWebUrl: origin,
    secureCookies: false,
    email: null,
    rateLimit: { key: randomBytes(32).toString("base64"), limit: 100, windowSeconds: 60 },
    oauth: {
      encryptionKey: randomBytes(32).toString("base64"),
      providers: { FACEBOOK: { clientId, clientSecret, graphVersion, redirectUri: callbackUri } },
    },
  };
  const adapter = createFacebookOAuthProvider({ clientId, clientSecret, graphVersion }, mockMetaFetch);
  const server = createApiServer({ customerAuthHandler: createCustomerAuthHandler(pool, config, { FACEBOOK: adapter }) });
  server.listen(port, "127.0.0.1");
  await once(server, "listening");

  try {
    const first = await start(origin);
    check(first.facebook.searchParams.get("redirect_uri") === callbackUri, "start uses the exact loopback Facebook callback URI");
    const firstCallback = await callback(origin, first, "facebook-success");
    check(firstCallback.status === 303 && firstCallback.headers.get("location") === `${origin}/en/account`, "Facebook callback completes through the real HTTP handler");
    const firstSession = cookie(firstCallback, "bnm_customer_session");
    check(Boolean(firstSession), "Facebook callback issues a customer session");
    const session = await fetch(`${origin}/api/v1/customer-auth/session`, { headers: { cookie: firstSession! } });
    check(session.status === 200, "Facebook customer session authenticates");
    const sessionBody = await session.json() as { data: { account: { email: string; emailVerified: boolean } } };
    check(sessionBody.data.account.email === "customer@example.test" && !sessionBody.data.account.emailVerified,
      "Facebook email is stored but never treated as verified");

    const replay = await callback(origin, first, "facebook-success");
    check(replay.status === 400 && tokenRequests === 1, "replayed Facebook state is rejected before provider exchange");

    const existing = await start(origin);
    const existingCallback = await callback(origin, existing, "facebook-existing-no-email");
    check(existingCallback.status === 303 && cookie(existingCallback, "bnm_customer_session"),
      "an existing provider subject can sign in when Facebook omits email");

    const collision = await start(origin);
    const collisionCallback = await callback(origin, collision, "facebook-email-collision");
    check(collisionCallback.status === 303 && collisionCallback.headers.get("location") === `${origin}/en/account?oauth=error`,
      "a new Facebook subject with an existing email is not auto-linked");

    const noEmail = await start(origin);
    const noEmailCallback = await callback(origin, noEmail, "facebook-new-no-email");
    check(noEmailCallback.status === 303 && noEmailCallback.headers.get("location") === `${origin}/en/account?oauth=error`,
      "a new Facebook subject without email cannot create an account");

    const totals = await pool.query<{ customers: number; accounts: number; identities: number; sessions: number; consumed: number }>(`
      SELECT (SELECT count(*)::int FROM customers) AS customers,
        (SELECT count(*)::int FROM customer_accounts) AS accounts,
        (SELECT count(*)::int FROM customer_identities) AS identities,
        (SELECT count(*)::int FROM customer_sessions) AS sessions,
        (SELECT count(*)::int FROM customer_oauth_transactions WHERE consumed_at IS NOT NULL) AS consumed
    `);
    check(totals.rows[0].customers === 1 && totals.rows[0].accounts === 1 && totals.rows[0].identities === 1,
      "only the original Facebook provider subject owns the customer account");
    check(totals.rows[0].sessions === 2, "only successful Facebook callbacks issue sessions");
    check(totals.rows[0].consumed === 4, "every bound callback consumes its transaction exactly once");
    console.log(`Customer Facebook OAuth E2E passed: ${checks} checks; isolated PostgreSQL, actual HTTP handler, mocked Meta transport, no live credentials.`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function start(origin: string) {
  const response = await fetch(`${origin}/api/v1/customer-auth/oauth/facebook/start?locale=en`, { redirect: "manual" });
  assert.equal(response.status, 302, "Facebook start must redirect");
  const location = response.headers.get("location");
  const binding = cookie(response, "bnm_customer_oauth_facebook");
  assert(location && binding, "Facebook start needs redirect and browser binding cookie");
  const facebook = new URL(location);
  const state = facebook.searchParams.get("state");
  assert(state, "Facebook redirect must include state");
  return { facebook, state, binding };
}

async function callback(origin: string, transaction: { state: string; binding: string }, code: string) {
  return fetch(`${origin}/api/v1/customer-auth/oauth/facebook/callback?state=${encodeURIComponent(transaction.state)}&code=${encodeURIComponent(code)}`, {
    headers: { cookie: transaction.binding }, redirect: "manual",
  });
}

async function mockMetaFetch(url: string | URL | Request, options: RequestInit = {}) {
  const endpoint = new URL(String(url));
  if (endpoint.pathname.endsWith("/oauth/access_token")) {
    tokenRequests += 1;
    check(endpoint.searchParams.get("client_id") === clientId && endpoint.searchParams.get("client_secret") === clientSecret,
      "adapter sends credentials only to the documented Facebook token endpoint");
    return json({ access_token: `token-${endpoint.searchParams.get("code")}`, expires_in: 3600 });
  }
  if (endpoint.pathname.endsWith("/debug_token")) {
    const token = endpoint.searchParams.get("input_token")!;
    check(endpoint.searchParams.get("access_token") === `${clientId}|${clientSecret}`, "debug uses app access token at the Meta debug endpoint");
    check(endpoint.searchParams.get("appsecret_proof") === facebookAppSecretProof(`${clientId}|${clientSecret}`, clientSecret), "debug request proves its app access token");
    return json({ data: { is_valid: true, app_id: clientId, user_id: subject(token), expires_at: now + 3600, data_access_expires_at: now + 7200 } });
  }
  if (endpoint.pathname.endsWith("/me")) {
    const authorization = options.headers instanceof Headers ? options.headers.get("authorization") : (options.headers as Record<string, string>).authorization;
    const token = authorization?.replace("Bearer ", "") ?? "";
    check(authorization === `Bearer ${token}`, "Facebook user access token reaches profile only through Authorization header");
    check(endpoint.searchParams.get("appsecret_proof") === facebookAppSecretProof(token, clientSecret), "profile request proves the user access token");
    const code = token.replace("token-", "");
    const missingEmail = code === "facebook-existing-no-email" || code === "facebook-new-no-email";
    return json({ id: subject(token), name: "Facebook E2E Customer", ...(missingEmail ? {} : { email: "Customer@Example.Test" }) });
  }
  throw new Error("Unexpected Meta request.");
}

function subject(token: string) {
  if (token.endsWith("facebook-email-collision")) return "facebook-subject-collision";
  if (token.endsWith("facebook-new-no-email")) return "facebook-subject-no-email";
  return "facebook-subject-e2e";
}

function cookie(response: Response, name: string) {
  const value = response.headers.get("set-cookie") ?? "";
  return value.match(new RegExp(`(?:^|,\\s*)(${name}=[^;]+)`))?.[1] ?? null;
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
  console.error(error instanceof Error ? error.message : "Customer Facebook OAuth E2E failed.");
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
  if (created) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  await admin.end();
});
