import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import pg from "pg";
import { runner } from "node-pg-migrate";
import { dispatchAuthEmails, queueAuthEmail, type EmailProvider } from "../../apps/api/src/features/customer-auth/email";
import { cleanupCustomerAuthEphemeralState, monitorAuthEmailOperations, waitForAuthEmailPoll } from "../../apps/api/src/features/customer-auth/email-operations";
import { newToken, tokenHash } from "../../apps/api/src/features/customer-auth/security";

const base = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh");
const name = `bep_email_ops_${randomUUID().replaceAll("-", "")}`;
const url = new URL(base);
url.pathname = `/${name}`;
const admin = new pg.Client({ connectionString: base.toString() });
const pool = new pg.Pool({ connectionString: url.toString(), max: 6 });
const config = { encryptionKey: randomBytes(32).toString("base64"), publicWebUrl: "https://shop.example" };
const dispatchPolicy = { batchSize: 10, maxAttempts: 2, baseDelaySeconds: 1, maxDelaySeconds: 10, leaseSeconds: 30 };
const alertPolicy = { backlogWarningCount: 2, backlogUrgentCount: 3, oldestWarningSeconds: 5, oldestUrgentSeconds: 10, dispatcherFailureAlertThreshold: 2 };
let created = false;

async function createSendableEvent(email: string) {
  const customerId = randomUUID();
  const accountId = randomUUID();
  const token = newToken();
  await pool.query("INSERT INTO customers(id, full_name, phone, address_line, city) VALUES ($1, 'Operations test', '0900000000', 'Address', 'City')", [customerId]);
  await pool.query("INSERT INTO customer_accounts(id, customer_id, normalized_email, status) VALUES ($1, $2, $3, 'ACTIVE')", [accountId, customerId, email]);
  await pool.query("INSERT INTO customer_auth_tokens(id, account_id, purpose, token_hash, target_email, expires_at) VALUES ($1, $2, 'VERIFY_EMAIL', $3, $4, now() + interval '1 day')", [randomUUID(), accountId, createHash("sha256").update(token).digest("hex"), email]);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const eventId = await queueAuthEmail(client, { accountId, token, purpose: "VERIFY_EMAIL", email, locale: "en" }, config);
    await client.query("COMMIT");
    return eventId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function activeAlerts() {
  return (await pool.query<{ dedupe_key: string; status: string; details: unknown }>(
    "SELECT dedupe_key, status, details FROM admin_alerts WHERE status IN ('OPEN','ACKNOWLEDGED') ORDER BY dedupe_key"
  )).rows;
}

async function main() {
  verifyDispatcherFailureLoop();
  await admin.connect();
  assert.match(name, /^bep_email_ops_[a-f0-9]{32}$/);
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await runner({ databaseUrl: url.toString(), dir: path.resolve("migrations"), direction: "up", migrationsTable: "pgmigrations", count: Infinity, log: () => undefined });

  const sent: string[] = [];
  const provider: EmailProvider = { send: async (input) => { sent.push(input.idempotencyKey); } };
  const first = await createSendableEvent("first@example.invalid");
  const second = await createSendableEvent("second@example.invalid");
  await pool.query("UPDATE outbox_events SET next_attempt_at=now()-interval '6 seconds' WHERE event_id IN ($1,$2)", [first, second]);
  await Promise.all(Array.from({ length: 8 }, () => monitorAuthEmailOperations(pool, { dispatcherId: "verify-worker-a", dispatcherFailureCount: 0, policy: alertPolicy })));
  let alerts = await activeAlerts();
  assert.equal(alerts.filter((entry) => entry.dedupe_key === "customer-auth-email:backlog").length, 1, "concurrent monitors dedupe backlog alerts");
  assert(!JSON.stringify(alerts).includes("first@example.invalid"), "alerts never contain recipient data");

  await dispatchAuthEmails(pool, { ...config, provider, policy: dispatchPolicy });
  await monitorAuthEmailOperations(pool, { dispatcherId: "verify-worker-a", dispatcherFailureCount: 0, policy: alertPolicy });
  const resolvedBacklog = await pool.query<{ status: string; resolution_reason: string }>("SELECT status, resolution_reason FROM admin_alerts WHERE dedupe_key='customer-auth-email:backlog' ORDER BY created_at DESC LIMIT 1");
  assert.equal(resolvedBacklog.rows[0]?.status, "RESOLVED");
  assert.equal(resolvedBacklog.rows[0]?.resolution_reason, "SYSTEM_RECOVERED");
  assert.equal(sent.length, 2);

  const retry = await createSendableEvent("retry@example.invalid");
  const failing: EmailProvider = { send: async () => { throw new Error("provider unavailable"); } };
  assert.deepEqual(await dispatchAuthEmails(pool, { ...config, provider: failing, policy: dispatchPolicy }), { sent: 0, retried: 1, quarantined: 0 });
  await pool.query("UPDATE outbox_events SET next_attempt_at=now() WHERE event_id=$1", [retry]);
  assert.deepEqual(await dispatchAuthEmails(pool, { ...config, provider: failing, policy: dispatchPolicy }), { sent: 0, retried: 0, quarantined: 1 });
  await monitorAuthEmailOperations(pool, { dispatcherId: "verify-worker-a", dispatcherFailureCount: 2, policy: alertPolicy });
  alerts = await activeAlerts();
  assert.equal(alerts.filter((entry) => entry.dedupe_key.startsWith("customer-auth-email:dispatcher-failure:")).length, 1);
  assert.equal(alerts.filter((entry) => entry.dedupe_key === "customer-auth-email:quarantined").length, 1);
  await monitorAuthEmailOperations(pool, { dispatcherId: "verify-worker-b", dispatcherFailureCount: 0, policy: alertPolicy });
  assert.equal((await activeAlerts()).filter((entry) => entry.dedupe_key.startsWith("customer-auth-email:dispatcher-failure:")).length, 1, "a healthy worker never resolves another worker's failure alert");
  await monitorAuthEmailOperations(pool, { dispatcherId: "verify-worker-a", dispatcherFailureCount: 1, policy: alertPolicy });
  assert.equal((await activeAlerts()).filter((entry) => entry.dedupe_key.startsWith("customer-auth-email:dispatcher-failure:")).length, 1, "a restarted worker below threshold preserves its existing failure alert");
  await pool.query("UPDATE admin_alerts SET status='ACKNOWLEDGED' WHERE dedupe_key='customer-auth-email:quarantined' AND status='OPEN'");
  await pool.query("UPDATE outbox_events SET quarantined_at=NULL, published_at=now() WHERE event_id=$1", [retry]);
  await monitorAuthEmailOperations(pool, { dispatcherId: "verify-worker-a", dispatcherFailureCount: 0, policy: alertPolicy });
  assert.equal((await activeAlerts()).some((entry) => entry.dedupe_key.startsWith("customer-auth-email:dispatcher-failure:")), false, "only a successful full iteration resolves this worker's failure alert");
  const recovered = await pool.query<{ status: string; resolution_reason: string }>("SELECT status, resolution_reason FROM admin_alerts WHERE dedupe_key='customer-auth-email:quarantined' ORDER BY created_at DESC LIMIT 1");
  assert.equal(recovered.rows[0]?.status, "RESOLVED", "recovery resolves acknowledged alerts without deleting history");
  assert.equal(recovered.rows[0]?.resolution_reason, "SYSTEM_RECOVERED");

  const expected = await createSendableEvent("expected@example.invalid");
  await pool.query("UPDATE customer_auth_tokens SET consumed_at=now() WHERE account_id=(SELECT aggregate_id FROM outbox_events WHERE event_id=$1)", [expected]);
  assert.deepEqual(await dispatchAuthEmails(pool, { ...config, provider, policy: dispatchPolicy }), { sent: 0, retried: 0, quarantined: 1 });
  await monitorAuthEmailOperations(pool, { dispatcherId: "verify-worker-a", dispatcherFailureCount: 0, policy: alertPolicy });
  assert.equal((await activeAlerts()).some((entry) => entry.dedupe_key === "customer-auth-email:quarantined"), false, "expired or replaced tokens are expected quarantines, not urgent alerts");

  const abortEvent = await createSendableEvent("abort@example.invalid");
  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(await dispatchAuthEmails(pool, { ...config, provider, policy: dispatchPolicy, signal: controller.signal }), { sent: 0, retried: 0, quarantined: 0 });
  assert.equal((await pool.query("SELECT count(*)::int count FROM outbox_events WHERE event_id=$1 AND lease_until > now()", [abortEvent])).rows[0].count, 0, "already-aborted dispatch never claims a batch");
  const secondAbortEvent = await createSendableEvent("abort-second@example.invalid");
  const duringSend = new AbortController();
  const abortingProvider: EmailProvider = { async send() { duringSend.abort(); } };
  assert.deepEqual(await dispatchAuthEmails(pool, { ...config, provider: abortingProvider, policy: dispatchPolicy, signal: duringSend.signal }), { sent: 1, retried: 0, quarantined: 0 });
  assert.equal((await pool.query("SELECT count(*)::int count FROM outbox_events WHERE event_id=ANY($1::uuid[]) AND lease_until > now()", [[abortEvent, secondAbortEvent]])).rows[0].count, 1, "mid-batch shutdown leaves only unsent claims reclaimable");
  await pool.query("UPDATE outbox_events SET lease_until=now()-interval '1 second' WHERE event_id=ANY($1::uuid[]) AND lease_token IS NOT NULL", [[abortEvent, secondAbortEvent]]);
  assert.deepEqual(await dispatchAuthEmails(pool, { ...config, provider, policy: dispatchPolicy }), { sent: 1, retried: 0, quarantined: 0 });

  await pool.query("INSERT INTO customer_auth_rate_limits(action, key_hash, window_started_at, window_expires_at, attempt_count) VALUES ('LOGIN', $1, now()-interval '2 hours', now()-interval '1 hour', 1)", [tokenHash(newToken())]);
  await pool.query("INSERT INTO customer_oauth_transactions(id, provider, state_hash, browser_binding_hash, redirect_uri, locale, created_at, expires_at) VALUES ($1, 'GOOGLE', $2, $3, 'https://shop.example/callback', 'en', now()-interval '20 minutes', now()-interval '10 minutes')", [randomUUID(), tokenHash(newToken()), tokenHash(newToken())]);
  assert.deepEqual(await cleanupCustomerAuthEphemeralState(pool, 10), { oauthTransactions: 1, rateLimits: 1 });
  const shutdown = new AbortController();
  const startedAt = Date.now();
  const waiting = waitForAuthEmailPoll(30, shutdown.signal);
  setTimeout(() => shutdown.abort(), 10);
  await waiting;
  assert(Date.now() - startedAt < 1_000, "watch polling exits promptly after a shutdown signal");
  const normalListeners = new Set<EventListenerOrEventListenerObject>();
  const normalSignal = {
    aborted: false,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => normalListeners.add(listener),
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => normalListeners.delete(listener)
  } as unknown as AbortSignal;
  await waitForAuthEmailPoll(1, normalSignal);
  assert.equal(normalListeners.size, 0, "normal poll completion removes its abort listener");
  console.log("Customer email operations verification passed: retry/quarantine, aggregate alerts, advisory-lock dedupe, recovery, cleanup and abort lease handling.");
}

function verifyDispatcherFailureLoop() {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", CUSTOMER_AUTH_ENABLED: "false",
    CUSTOMER_AUTH_GOOGLE_ENABLED: "false", CUSTOMER_AUTH_FACEBOOK_ENABLED: "false", CUSTOMER_AUTH_RATE_LIMIT_KEY: "",
    DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/fixture", PUBLIC_WEB_URL: "https://shop.example",
    CUSTOMER_AUTH_EMAIL_DISPATCH_ENABLED: "true", CUSTOMER_AUTH_EMAIL_KEY: config.encryptionKey,
    EMAIL_PROVIDER: "resend", RESEND_API_KEY: "fixture-not-a-real-key", EMAIL_FROM: "fixture@example.invalid",
    CUSTOMER_AUTH_EMAIL_WORKER_ID: "verify-offline-worker", CUSTOMER_AUTH_EMAIL_BATCH_SIZE: "1",
    CUSTOMER_AUTH_EMAIL_MAX_ATTEMPTS: "2", CUSTOMER_AUTH_EMAIL_RETRY_BASE_SECONDS: "1",
    CUSTOMER_AUTH_EMAIL_RETRY_CAP_SECONDS: "2", CUSTOMER_AUTH_EMAIL_LEASE_SECONDS: "30",
    CUSTOMER_AUTH_EMAIL_POLL_SECONDS: "1", CUSTOMER_AUTH_EMAIL_FAILURE_BASE_SECONDS: "1",
    CUSTOMER_AUTH_EMAIL_FAILURE_CAP_SECONDS: "1", CUSTOMER_AUTH_EMAIL_FAILURE_MAX_CONSECUTIVE: "2",
    CUSTOMER_AUTH_EMAIL_CLEANUP_BATCH_SIZE: "10", CUSTOMER_AUTH_EMAIL_BACKLOG_WARNING_COUNT: "2",
    CUSTOMER_AUTH_EMAIL_BACKLOG_URGENT_COUNT: "3", CUSTOMER_AUTH_EMAIL_BACKLOG_WARNING_AGE_SECONDS: "5",
    CUSTOMER_AUTH_EMAIL_BACKLOG_URGENT_AGE_SECONDS: "10", CUSTOMER_AUTH_EMAIL_DISPATCHER_FAILURE_ALERT_THRESHOLD: "1" };
  const args = ["--import", "tsx", path.resolve("scripts/email/dispatch-auth.ts")];
  const start = Date.now();
  // An unreachable local database prevents the real provider adapter from ever sending mail.
  const watched = spawnSync(process.execPath, [...args, "--watch"], { env, encoding: "utf8", timeout: 20_000, windowsHide: true });
  assert.equal(watched.status, 1, "watch exits nonzero after the configured operational failure budget");
  assert.equal(watched.stderr.match(/Email dispatcher operational-error:/g)?.length, 2);
  assert(Date.now() - start >= 900, "watch respects failure backoff instead of busy-looping");
  assert(!watched.stderr.includes("fixture-not-a-real-key") && !watched.stderr.includes("postgresql://"));
  for (const invalid of [["--dry-run"], ["--watch", "--watch"]]) {
    const result = spawnSync(process.execPath, [...args, ...invalid], { env, encoding: "utf8", timeout: 10_000, windowsHide: true });
    assert.equal(result.status, 1);
    assert(!result.stderr.includes("Email dispatcher operational-error:"), "invalid flags fail before dispatcher/database work");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Customer email operations verification failed.");
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
  if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.end();
});
