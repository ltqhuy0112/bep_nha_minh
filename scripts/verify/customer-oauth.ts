import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import path from "node:path";
import pg from "pg";
import { runner } from "node-pg-migrate";
import { createApiServer } from "../../apps/api/src/runtime/http-server";
import { createCustomerAuthHandler } from "../../apps/api/src/features/customer-auth/http";
import { readCustomerAuthConfig, type CustomerAuthConfig } from "../../apps/api/src/features/customer-auth/config";
import type { OAuthIdentity, OAuthProviderAdapter } from "../../apps/api/src/features/customer-auth/oauth-provider";
import { newToken, tokenHash } from "../../apps/api/src/features/customer-auth/security";

const base = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh");
const name = `bep_oauth_${randomUUID().replaceAll("-", "")}`;
const url = new URL(base); url.pathname = `/${name}`;
const admin = new pg.Client({ connectionString: base.toString() });
const pool = new pg.Pool({ connectionString: url.toString(), max: 8 });
const config: CustomerAuthConfig = { enabled: true, publicWebUrl: "https://shop.example", secureCookies: true, email: null,
  rateLimit: { key: randomBytes(32).toString("base64"), limit: 100, windowSeconds: 60 },
  oauth: { encryptionKey: randomBytes(32).toString("base64"), providers: {
    GOOGLE: { clientId: "test-client", clientSecret: "test-only", redirectUri: "https://shop.example/api/customer-auth/oauth/google/callback" }
  } } };
let identity: OAuthIdentity = { provider: "GOOGLE", subject: "subject-1", email: "oauth@example.test", emailVerified: true, fullName: "OAuth customer" };
const proofByState = new Map<string, string>();
let exchanges = 0;
const provider: OAuthProviderAdapter = { provider: "GOOGLE", async authorizationUrl(input) {
  proofByState.set(input.state, input.pkceVerifier);
  return `https://accounts.google.com/o/oauth2/v2/auth?state=${input.state}`;
}, async exchange(input) {
  assert.equal(input.pkceVerifier, proofByState.get(input.state));
  assert.equal(input.redirectUri, config.oauth!.providers.GOOGLE!.redirectUri);
  exchanges++;
  if (input.code === "provider-failure") throw new Error("test provider secret must not escape");
  return { ...identity };
} };
const server = createApiServer({ customerAuthHandler: createCustomerAuthHandler(pool, config, { GOOGLE: provider }) });
let origin = "";
let created = false;

async function start(locale = "vi") {
  const response = await fetch(`${origin}/api/v1/customer-auth/oauth/google/start?locale=${locale}`, { redirect: "manual" });
  assert.equal(response.status, 302);
  const state = new URL(response.headers.get("location")!).searchParams.get("state")!;
  const cookie = response.headers.getSetCookie()[0];
  assert.match(cookie, /^__Host-bnm_customer_oauth_google=.*; Path=\/; HttpOnly; SameSite=Lax; Max-Age=600; Secure$/);
  return { state, cookie: cookie.split(";")[0] };
}
async function callback(transaction: { state: string; cookie: string }, code = "ok") {
  return fetch(`${origin}/api/v1/customer-auth/oauth/google/callback?state=${transaction.state}&code=${code}`,
    { redirect: "manual", headers: { cookie: transaction.cookie, "sec-fetch-site": "cross-site" } });
}
async function main() {
  assert.match(name, /^bep_oauth_[a-f0-9]{32}$/); assert.notEqual(base.pathname, url.pathname);
  await admin.connect(); await admin.query(`CREATE DATABASE "${name}"`); created = true;
  await runner({ databaseUrl: url.toString(), dir: path.resolve("migrations"), direction: "up", count: Infinity, migrationsTable: "pgmigrations", log: () => undefined });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  assert.equal((await (await fetch(`${origin}/api/v1/customer-auth/config`)).json()).data.oauth.google, true);
  const first = await start("en");
  assert.equal((await callback({ ...first, cookie: `__Host-bnm_customer_oauth_google=${newToken()}` })).status, 400);
  assert.equal(exchanges, 0);
  const results = await Promise.all([callback(first), callback(first)]);
  assert.deepEqual(results.map((entry) => entry.status).sort(), [303, 400]);
  const response = results.find((entry) => entry.status === 303)!;
  assert.equal(response.headers.get("location"), `${config.publicWebUrl}/en/account`);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const sessionCookie = response.headers.getSetCookie().find((value) => value.startsWith("__Host-bnm_customer_session="))!.split(";")[0];
  const session = await fetch(`${origin}/api/v1/customer-auth/session`, { headers: { cookie: sessionCookie } });
  assert.equal(session.status, 200);
  const account = (await session.json()).data.account;
  assert.equal(account.emailVerified, true);
  assert.equal(exchanges, 1);
  const storedSession = (await pool.query("SELECT * FROM customer_sessions")).rows[0];
  assert.equal(storedSession.token_hash, tokenHash(sessionCookie.split("=")[1]));
  assert(Math.abs(storedSession.expires_at.getTime() - Date.now() - 30 * 86400_000) < 5000);

  identity.email = "changed@example.test";
  const repeat = await callback(await start());
  assert.equal(repeat.headers.get("location"), `${config.publicWebUrl}/vi/account`);
  assert.equal((await pool.query("SELECT count(*)::int n FROM customer_accounts")).rows[0].n, 1);
  assert.equal((await pool.query("SELECT normalized_email FROM customer_accounts")).rows[0].normalized_email, "oauth@example.test", "Provider profile changes never rewrite account ownership");

  identity = { ...identity, subject: "different-subject", email: "oauth@example.test" };
  const collision = await callback(await start());
  assert.equal(collision.headers.get("location"), `${config.publicWebUrl}/vi/account?oauth=error`);
  assert(!collision.headers.getSetCookie().some((value) => value.startsWith("__Host-bnm_customer_session=")));
  assert.equal((await pool.query("SELECT count(*)::int n FROM customer_identities")).rows[0].n, 1);
  assert.equal((await pool.query("SELECT count(*)::int n FROM customers")).rows[0].n, 1, "Collision rolls back orphan profile");
  identity.email = null;
  assert.match((await callback(await start())).headers.get("location")!, /oauth=error$/);
  identity = { ...identity, subject: "unverified-google", email: "unverified@example.test", emailVerified: false };
  assert.match((await callback(await start())).headers.get("location")!, /oauth=error$/);
  assert.equal((await pool.query("SELECT count(*)::int n FROM customers WHERE email='unverified@example.test'")).rows[0].n, 0);
  identity.emailVerified = true;
  const localCustomer = (await pool.query("INSERT INTO customers(full_name,email) VALUES ('Existing local','local@example.test') RETURNING id")).rows[0];
  await pool.query("INSERT INTO customer_accounts(customer_id,normalized_email) VALUES ($1,'local@example.test')", [localCustomer.id]);
  identity = { ...identity, email: "local@example.test", subject: "cannot-link-local" };
  assert.match((await callback(await start())).headers.get("location")!, /oauth=error$/);
  assert.equal((await pool.query("SELECT count(*)::int n FROM customer_identities WHERE provider_subject='cannot-link-local'")).rows[0].n, 0);
  identity = { ...identity, email: "concurrent@example.test", subject: "concurrent-subject" };
  const concurrent = await Promise.all([start(), start()]);
  const concurrentResponses = await Promise.all(concurrent.map((transaction) => callback(transaction)));
  assert(concurrentResponses.every((entry) => entry.headers.get("location") === `${config.publicWebUrl}/vi/account`));
  assert.equal((await pool.query("SELECT count(*)::int n FROM customer_identities WHERE provider_subject='concurrent-subject'")).rows[0].n, 1);
  identity = { ...identity, subject: "subject-1" };
  await pool.query("UPDATE customer_accounts SET status='DISABLED'");
  assert.match((await callback(await start())).headers.get("location")!, /oauth=error$/);
  await pool.query("UPDATE customer_accounts SET status='ACTIVE'");

  const held = await pool.connect();
  try {
    const before = (await pool.query("SELECT count(*)::int n FROM customer_sessions")).rows[0].n;
    const duringDisable = await start();
    await held.query("BEGIN");
    await held.query("UPDATE customer_accounts SET status='DISABLED' WHERE id=$1", [account.id]);
    const pendingCallback = callback(duringDisable);
    let waiting = false;
    for (let i = 0; i < 100 && !waiting; i++) {
      const activity = await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=$1 AND wait_event_type='Lock' AND query LIKE '%customer_identities%'", [name]);
      waiting = Boolean(activity.rowCount);
      if (!waiting) await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await held.query("COMMIT");
    const afterDisable = await pendingCallback;
    assert(waiting, "OAuth callback actually waited on the account row lock");
    assert.match(afterDisable.headers.get("location")!, /oauth=error$/);
    assert.equal((await pool.query("SELECT count(*)::int n FROM customer_sessions")).rows[0].n, before);
  } finally { await held.query("ROLLBACK"); held.release(); }
  await pool.query("UPDATE customer_accounts SET status='ACTIVE'");

  const expired = await start();
  await pool.query("UPDATE customer_oauth_transactions SET created_at=now()-interval '11 minutes',expires_at=now()-interval '1 minute' WHERE state_hash=$1", [tokenHash(expired.state)]);
  assert.equal((await callback(expired)).status, 400);
  const failure = await callback(await start(), "provider-failure");
  assert.match(failure.headers.get("location")!, /oauth=error$/);
  assert(!JSON.stringify([...failure.headers]).includes("test provider secret"));
  const denied = await start();
  const deniedResponse = await fetch(`${origin}/api/v1/customer-auth/oauth/google/callback?state=${denied.state}&error=access_denied`, { redirect: "manual", headers: { cookie: denied.cookie } });
  assert.equal(deniedResponse.status, 303);
  assert.equal((await callback(denied)).status, 400);
  assert.equal((await fetch(`${origin}/api/v1/customer-auth/oauth/google/start?return=https://evil.example`, { redirect: "manual" })).status, 400);
  assert.equal((await fetch(`${origin}/api/v1/customer-auth/oauth/google/start`, { redirect: "manual", headers: { "sec-fetch-site": "cross-site" } })).status, 403);
  assert.equal((await fetch(`${origin}/api/v1/customer-auth/oauth/google/start?locale=vi&locale=en`, { redirect: "manual" })).status, 400);
  assert.equal((await pool.query("SELECT count(*)::int n FROM admin_users")).rows[0].n, 0);
  assert.equal((await pool.query("SELECT count(*)::int n FROM orders")).rows[0].n, 0);
  const env = { NODE_ENV: "test" as const, PUBLIC_WEB_URL: config.publicWebUrl, CUSTOMER_AUTH_GOOGLE_ENABLED: "true",
    CUSTOMER_AUTH_OAUTH_KEY: config.oauth!.encryptionKey, CUSTOMER_AUTH_GOOGLE_CLIENT_ID: "fixture", CUSTOMER_AUTH_GOOGLE_CLIENT_SECRET: "fixture",
    CUSTOMER_AUTH_GOOGLE_REDIRECT_URI: config.oauth!.providers.GOOGLE!.redirectUri,
    CUSTOMER_AUTH_OAUTH_REDIRECT_URIS: JSON.stringify([config.oauth!.providers.GOOGLE!.redirectUri]) };
  assert(readCustomerAuthConfig(env).oauth?.providers.GOOGLE);
  assert.throws(() => readCustomerAuthConfig({ ...env, CUSTOMER_AUTH_OAUTH_REDIRECT_URIS: "[]" }), /allowlisted/);
  console.log("Google OAuth HTTP/database verification passed: callback, PKCE handoff, state/binding/expiry/replay, subject lookup, no email linking, sessions and isolated legacy/admin preservation. Provider network is mocked, not live Google.");
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "OAuth verification failed."); process.exitCode = 1; }).finally(async () => {
  if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end(); if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`); await admin.end();
});
