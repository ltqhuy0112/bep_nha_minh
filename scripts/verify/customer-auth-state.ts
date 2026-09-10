import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import path from "node:path";
import pg from "pg";
import { runner } from "node-pg-migrate";
import { OAuthTransactionStore, cleanupOAuthTransactions } from "../../apps/api/src/features/customer-auth/oauth-transactions";
import { SharedAuthLimiter, cleanupAuthRateLimits } from "../../apps/api/src/features/customer-auth/rate-limit";
import { AuthError, newToken, tokenHash } from "../../apps/api/src/features/customer-auth/security";
import { createCustomerAuthHandler } from "../../apps/api/src/features/customer-auth/http";
import { createApiServer } from "../../apps/api/src/runtime/http-server";

const base = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh");
const name = `bep_auth_state_${randomUUID().replaceAll("-", "")}`;
const url = new URL(base);
url.pathname = `/${name}`;
const admin = new pg.Client({ connectionString: base.toString() });
const pool = new pg.Pool({ connectionString: url.toString(), max: 8 });
const replica = new pg.Pool({ connectionString: url.toString(), max: 8 });
const ratePolicy = { key: randomBytes(32).toString("base64"), limit: 7, windowSeconds: 3600 };
const oauthConfig = { encryptionKey: randomBytes(32).toString("base64"), redirectUris: {
  GOOGLE: "https://shop.example/api/customer-auth/oauth/google/callback",
  FACEBOOK: "https://shop.example/api/customer-auth/oauth/facebook/callback"
} };
const config = { enabled: true, publicWebUrl: "https://shop.example", secureCookies: true, email: null,
  rateLimit: { ...ratePolicy, limit: 2 } };
const servers = [createApiServer({ customerAuthHandler: createCustomerAuthHandler(pool, config) }),
  createApiServer({ customerAuthHandler: createCustomerAuthHandler(replica, config) })];
let created = false;

async function main() {
  assert.match(name, /^bep_auth_state_[a-f0-9]{32}$/);
  assert.notEqual(base.pathname, url.pathname);
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await runner({ databaseUrl: url.toString(), dir: path.resolve("migrations"), direction: "up",
    migrationsTable: "pgmigrations", count: Infinity, log: () => undefined });

  const limiters = [new SharedAuthLimiter(pool, ratePolicy), new SharedAuthLimiter(replica, ratePolicy)];
  const identity = "email:private-person@example.test";
  const attempts = await Promise.all(Array.from({ length: 40 }, (_, i) => limiters[i % 2].take("LOGIN", identity)));
  assert.equal(attempts.filter((entry) => entry.allowed).length, 7, "Two replicas share exactly seven admissions");
  assert(attempts.every((entry) => entry.retryAfterSeconds > 0 && entry.retryAfterSeconds <= 3600));
  const counters = (await pool.query("SELECT * FROM customer_auth_rate_limits")).rows;
  assert.equal(counters.length, 1);
  assert.equal(counters[0].attempt_count, 8, "Rejected count saturates at limit+1");
  assert.match(counters[0].key_hash, /^[a-f0-9]{64}$/);
  assert(!JSON.stringify(counters).includes("private-person"));
  assert((await limiters[1].take("RESET", identity)).allowed, "Action scopes are independent");
  assert((await limiters[1].take("LOGIN", "session:another-secret")).allowed);
  await pool.query(`INSERT INTO customer_auth_rate_limits VALUES
    ('LOGIN',$1,now()-interval '2 hours',now()-interval '1 hour',1)`, [tokenHash(newToken())]);
  assert.equal(await cleanupAuthRateLimits(pool, 1), 1);
  assert.equal(await cleanupAuthRateLimits(pool), 0, "Active windows survive cleanup");
  assert.equal((await limiters[0].take("LOGIN", identity)).allowed, false, "Cleanup does not reset active enforcement");

  const stores = [new OAuthTransactionStore(pool, oauthConfig), new OAuthTransactionStore(replica, oauthConfig)];
  const verifier = newToken();
  const issued = await stores[0].create({ provider: "GOOGLE", locale: "vi", pkceVerifier: verifier });
  assert.notEqual(issued.state, issued.browserBinding);
  const row = (await pool.query("SELECT * FROM customer_oauth_transactions")).rows[0];
  assert.equal(row.expires_at.getTime() - row.created_at.getTime(), 600_000);
  for (const secret of [issued.state, issued.browserBinding, verifier]) assert(!JSON.stringify(row).includes(secret));
  const input = { provider: "GOOGLE" as const, state: issued.state, browserBinding: issued.browserBinding };
  const invalid = (error: unknown) => error instanceof AuthError && error.code === "INVALID_OAUTH_TRANSACTION";
  await assert.rejects(stores[0].consume({ ...input, browserBinding: newToken() }), invalid);
  await assert.rejects(stores[0].consume({ ...input, provider: "FACEBOOK" }), invalid);
  const consumed = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => stores[i % 2].consume(input)));
  const successful = consumed.filter((entry) => entry.status === "fulfilled");
  assert.equal(successful.length, 1, "State is single-use across replicas");
  assert.equal(successful[0].value.pkceVerifier, verifier);
  assert.equal(successful[0].value.locale, "vi");
  assert(consumed.filter((entry) => entry.status === "rejected").every((entry) => invalid(entry.reason)));

  const expired = await stores[0].create({ provider: "FACEBOOK", locale: "en" });
  await pool.query(`UPDATE customer_oauth_transactions SET created_at=now()-interval '11 minutes',
    expires_at=now()-interval '1 minute' WHERE state_hash=$1`, [tokenHash(expired.state)]);
  await assert.rejects(stores[0].consume({ ...expired, provider: "FACEBOOK" }), invalid);
  assert.equal(await cleanupOAuthTransactions(pool), 1);
  assert.equal((await pool.query("SELECT count(*)::int n FROM customer_oauth_transactions")).rows[0].n, 1);

  const pending = await stores[0].create({ provider: "GOOGLE", locale: "en", pkceVerifier: newToken() });
  const pendingInput = { ...pending, provider: "GOOGLE" as const };
  const changedAllowlist = new OAuthTransactionStore(pool, { ...oauthConfig, redirectUris: {
    GOOGLE: "https://shop.example/changed-callback"
  } });
  await assert.rejects(changedAllowlist.consume(pendingInput), invalid);
  const rotatedKey = new OAuthTransactionStore(pool, { ...oauthConfig, encryptionKey: randomBytes(32).toString("base64") });
  await assert.rejects(rotatedKey.consume(pendingInput), (error: unknown) => error instanceof AuthError && error.status === 503);
  assert.equal((await pool.query("SELECT consumed_at FROM customer_oauth_transactions WHERE state_hash=$1", [tokenHash(pending.state)])).rows[0].consumed_at, null);
  await stores[0].consume(pendingInput);
  assert.throws(() => new OAuthTransactionStore(pool, { ...oauthConfig, redirectUris: { GOOGLE: "https://shop.example/callback?return=https://evil.example" } }));
  assert.throws(() => new OAuthTransactionStore(pool, { ...oauthConfig, redirectUris: { GOOGLE: "http://external.example/callback" } }));

  const waiting = await stores[0].create({ provider: "FACEBOOK", locale: "en" });
  await pool.query(`UPDATE customer_oauth_transactions SET created_at=now()-interval '9 minutes',
    expires_at=clock_timestamp()+interval '300 milliseconds' WHERE state_hash=$1`, [tokenHash(waiting.state)]);
  const lock = await pool.connect();
  try {
    await lock.query("BEGIN");
    await lock.query("SELECT id FROM customer_oauth_transactions WHERE state_hash=$1 FOR UPDATE", [tokenHash(waiting.state)]);
    const blocked = assert.rejects(stores[1].consume({ ...waiting, provider: "FACEBOOK" }), invalid);
    await lock.query("SELECT pg_sleep(0.5)");
    await lock.query("COMMIT");
    await blocked;
  } finally { await lock.query("ROLLBACK"); lock.release(); }

  const offline = await stores[0].create({ provider: "FACEBOOK", locale: "vi" });
  await pool.query("ALTER TABLE customer_oauth_transactions RENAME TO oauth_transactions_unavailable");
  await assert.rejects(stores[0].consume({ ...offline, provider: "FACEBOOK" }),
    (error: unknown) => error instanceof AuthError && error.status === 503 && error.code === "OAUTH_TRANSACTION_UNAVAILABLE");
  await pool.query("ALTER TABLE oauth_transactions_unavailable RENAME TO customer_oauth_transactions");
  await stores[0].consume({ ...offline, provider: "FACEBOOK" });

  for (const server of servers) { server.listen(0, "127.0.0.1"); await once(server, "listening"); }
  const endpoint = (i: number) => `http://127.0.0.1:${(servers[i].address() as AddressInfo).port}/api/v1/customer-auth/forgot-password`;
  for (let i = 0; i < 3; i++) {
    const response = await fetch(endpoint(i % 2), { method: "POST", headers: {
      "content-type": "application/json", origin: config.publicWebUrl
    }, body: JSON.stringify({ email: i % 2 ? " RATE@example.test " : "rate@example.test" }) });
    assert.equal(response.status, i < 2 ? 503 : 429, "Two HTTP handlers share a normalized identity cap even when email is unavailable");
    const body = await response.json();
    if (i === 2) { assert.equal(body.error.code, "RATE_LIMITED"); assert(Number(response.headers.get("retry-after")) > 0); }
  }
  await pool.query("ALTER TABLE customer_auth_rate_limits RENAME TO rate_limits_unavailable");
  const unavailable = await fetch(endpoint(0), { method: "POST", headers: { origin: config.publicWebUrl, "content-type": "application/json" }, body: "{}" });
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).error.code, "AUTH_RATE_LIMIT_UNAVAILABLE");
  await pool.query("ALTER TABLE rate_limits_unavailable RENAME TO customer_auth_rate_limits");
  assert.equal((await pool.query("SELECT count(*)::int n FROM audit_logs")).rows[0].n, 0, "Ephemeral cleanup does not create or replace audit history");
  console.log("Customer auth state verification passed: shared concurrency/HTTP/fail-closed limits, atomic OAuth consumption, expiry after lock, encryption, binding, allowlist and cleanup.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Customer auth state verification failed."); process.exitCode = 1;
}).finally(async () => {
  for (const server of servers) if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
  await replica.end();
  if (created) {
    // pg pool shutdown can precede server-side socket teardown; do not force-kill that race.
    for (let i = 0; i < 50; i++) {
      const connections = await admin.query("SELECT count(*)::int n FROM pg_stat_activity WHERE datname=$1", [name]);
      if (connections.rows[0].n === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await admin.query(`DROP DATABASE "${name}"`);
  }
  await admin.end();
});
