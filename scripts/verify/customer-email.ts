import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import pg from "pg";
import { runner } from "node-pg-migrate";
import {
  dispatchAuthEmails,
  queueAuthEmail,
  type EmailProvider
} from "../../apps/api/src/features/customer-auth/email";

const baseUrl = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh");
const databaseName = `bep_customer_email_${randomUUID().replaceAll("-", "")}`;
const testUrl = new URL(baseUrl);
testUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: baseUrl.toString() });
const pool = new pg.Pool({ connectionString: testUrl.toString() });
const key = randomBytes(32).toString("base64");
const config = { encryptionKey: key, publicWebUrl: "https://bepnhaminh.example" };
const policy = { batchSize: 10, maxAttempts: 2, baseDelaySeconds: 1, maxDelaySeconds: 10, leaseSeconds: 30 };
let created = false;

async function createAccount(email: string) {
  const customerId = randomUUID();
  const accountId = randomUUID();
  await pool.query("INSERT INTO customers(id, full_name, phone, address_line, city) VALUES ($1, 'Email test', '0900000000', 'Address', 'City')", [customerId]);
  await pool.query("INSERT INTO customer_accounts(id, customer_id, normalized_email, status) VALUES ($1, $2, $3, 'ACTIVE')", [accountId, customerId, email]);
  return accountId;
}

async function addToken(accountId: string, token: string, email: string, expires: string) {
  await pool.query(
    "INSERT INTO customer_auth_tokens(id, account_id, purpose, token_hash, target_email, expires_at, created_at) VALUES ($1, $2, 'VERIFY_EMAIL', $3, $4, $5, $5::timestamptz - interval '1 day')",
    [randomUUID(), accountId, createHash("sha256").update(token).digest("hex"), email, expires]
  );
}

async function main() {
  await admin.connect();
  assert(/^bep_customer_email_[a-f0-9]{32}$/.test(databaseName));
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  await runner({ databaseUrl: testUrl.toString(), dir: path.resolve("migrations"), direction: "up", migrationsTable: "pgmigrations", checkOrder: false, singleTransaction: true, logger: { info() {}, warn() {}, error() {} } });

  const sent: Array<{ idempotencyKey: string; to: string; text: string }> = [];
  const provider: EmailProvider = { send: async (input) => { sent.push(input); } };
  const email = "customer@example.invalid";
  const token = "sensitive-token";
  const accountId = await createAccount(email);
  await addToken(accountId, token, email, "2099-01-01T00:00:00Z");
  const client = await pool.connect();
  let eventId: string;
  try {
    await client.query("BEGIN");
    eventId = await queueAuthEmail(client, { accountId, token, purpose: "VERIFY_EMAIL", email, locale: "en" }, config);
    await client.query("COMMIT");
  } finally {
    client.release();
  }
  const queued = await pool.query<{ payload: unknown }>("SELECT payload FROM outbox_events WHERE event_id=$1", [eventId!]);
  assert(!JSON.stringify(queued.rows[0].payload).includes(token));
  assert(!JSON.stringify(queued.rows[0].payload).includes(email));
  assert.deepEqual(await dispatchAuthEmails(pool, { ...config, provider, policy }), { sent: 1, retried: 0, quarantined: 0 });
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /\/en\/auth\/verify-email#token=sensitive-token/);
  const completed = await pool.query<{ payload: unknown; published_at: Date }>("SELECT payload, published_at FROM outbox_events WHERE event_id=$1", [eventId!]);
  assert(completed.rows[0].published_at);
  assert.equal(JSON.stringify(completed.rows[0].payload).includes(token), false);

  const expiredToken = "expired-token";
  const expiredAccount = await createAccount("expired@example.invalid");
  await addToken(expiredAccount, expiredToken, "expired@example.invalid", "2000-01-01T00:00:00Z");
  const expiredClient = await pool.connect();
  try {
    await expiredClient.query("BEGIN");
    await queueAuthEmail(expiredClient, { accountId: expiredAccount, token: expiredToken, purpose: "VERIFY_EMAIL", email: "expired@example.invalid", locale: "vi" }, config);
    await expiredClient.query("COMMIT");
  } finally { expiredClient.release(); }
  assert.deepEqual(await dispatchAuthEmails(pool, { ...config, provider, policy }), { sent: 0, retried: 0, quarantined: 1 });
  assert.equal(sent.length, 1);

  const disabledToken = "disabled-token";
  const disabledAccount = await createAccount("disabled@example.invalid");
  await addToken(disabledAccount, disabledToken, "disabled@example.invalid", "2099-01-01T00:00:00Z");
  await pool.query("UPDATE customer_accounts SET status='DISABLED' WHERE id=$1", [disabledAccount]);
  const disabledClient = await pool.connect();
  try {
    await disabledClient.query("BEGIN");
    await queueAuthEmail(disabledClient, { accountId: disabledAccount, token: disabledToken, purpose: "VERIFY_EMAIL", email: "disabled@example.invalid", locale: "en" }, config);
    await disabledClient.query("COMMIT");
  } finally { disabledClient.release(); }
  assert.deepEqual(await dispatchAuthEmails(pool, { ...config, provider, policy }), { sent: 0, retried: 0, quarantined: 1 });
  assert.equal(sent.length, 1);

  const heldToken = "held-token";
  const heldAccount = await createAccount("held@example.invalid");
  await addToken(heldAccount, heldToken, "held@example.invalid", "2099-01-01T00:00:00Z");
  const heldClient = await pool.connect();
  let heldEvent: string;
  try {
    await heldClient.query("BEGIN");
    heldEvent = await queueAuthEmail(heldClient, { accountId: heldAccount, token: heldToken, purpose: "VERIFY_EMAIL", email: "held@example.invalid", locale: "en" }, config);
    await heldClient.query("COMMIT");
  } finally { heldClient.release(); }
  await pool.query("UPDATE outbox_events SET lease_owner='other-worker', lease_token=$2, lease_until=now()+interval '1 minute' WHERE event_id=$1", [heldEvent!, randomUUID()]);
  assert.deepEqual(await dispatchAuthEmails(pool, { ...config, provider, policy }), { sent: 0, retried: 0, quarantined: 0 });
  assert.equal(sent.length, 1, "an event held by another lease must not reach the provider");

  const unreadableToken = "unreadable-token";
  const unreadableAccount = await createAccount("unreadable@example.invalid");
  await addToken(unreadableAccount, unreadableToken, "unreadable@example.invalid", "2099-01-01T00:00:00Z");
  const unreadableClient = await pool.connect();
  let unreadableEvent: string;
  try {
    await unreadableClient.query("BEGIN");
    unreadableEvent = await queueAuthEmail(unreadableClient, { accountId: unreadableAccount, token: unreadableToken, purpose: "VERIFY_EMAIL", email: "unreadable@example.invalid", locale: "en" }, config);
    await unreadableClient.query("COMMIT");
  } finally { unreadableClient.release(); }
  const encrypted = await pool.query<{ payload: unknown }>("SELECT payload FROM outbox_events WHERE event_id=$1", [unreadableEvent!]);
  assert.deepEqual(await dispatchAuthEmails(pool, { encryptionKey: randomBytes(32).toString("base64"), publicWebUrl: config.publicWebUrl, provider, policy }), { sent: 0, retried: 0, quarantined: 1 });
  const unreadable = await pool.query<{ payload: unknown; last_error: string }>("SELECT payload, last_error FROM outbox_events WHERE event_id=$1", [unreadableEvent!]);
  assert.deepEqual(unreadable.rows[0].payload, encrypted.rows[0].payload);
  assert.equal(unreadable.rows[0].last_error, "PAYLOAD_UNREADABLE");
  assert.equal(sent.length, 1);
  await assert.rejects(
    dispatchAuthEmails(pool, { ...config, provider, policy: { ...policy, maxAttempts: 21 } }),
    /Invalid email dispatch policy/
  );
  await assert.rejects(
    dispatchAuthEmails(pool, { ...config, provider, policy: { ...policy, leaseSeconds: 29 } }),
    /Invalid email dispatch policy/
  );
  await assert.rejects(
    dispatchAuthEmails(pool, { ...config, provider, policy: { ...policy, leaseSeconds: 301 } }),
    /Invalid email dispatch policy/
  );

  const retryToken = "retry-token";
  const retryAccount = await createAccount("retry@example.invalid");
  await addToken(retryAccount, retryToken, "retry@example.invalid", "2099-01-01T00:00:00Z");
  const retryClient = await pool.connect();
  let retryEvent: string;
  try {
    await retryClient.query("BEGIN");
    retryEvent = await queueAuthEmail(retryClient, { accountId: retryAccount, token: retryToken, purpose: "VERIFY_EMAIL", email: "retry@example.invalid", locale: "en" }, config);
    await retryClient.query("COMMIT");
  } finally { retryClient.release(); }
  const failing: EmailProvider = { send: async () => { throw new Error("provider failure"); } };
  assert.deepEqual(await dispatchAuthEmails(pool, { ...config, provider: failing, policy }), { sent: 0, retried: 1, quarantined: 0 });
  await pool.query("UPDATE outbox_events SET next_attempt_at=now() WHERE event_id=$1", [retryEvent!]);
  assert.deepEqual(await dispatchAuthEmails(pool, { ...config, provider: failing, policy }), { sent: 0, retried: 0, quarantined: 1 });
  const quarantined = await pool.query<{ payload: unknown; last_error: string }>("SELECT payload, last_error FROM outbox_events WHERE event_id=$1", [retryEvent!]);
  assert.equal(quarantined.rows[0].last_error, "EMAIL_DELIVERY_FAILED");
  assert.equal(JSON.stringify(quarantined.rows[0].payload).includes(retryToken), false);
  console.log("Customer email verification passed: encrypted outbox, token recheck, dispatch, retry, quarantine, and secret-free receipts.");
}

main().catch((error: unknown) => {
  console.error("Customer email verification failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
  if (created) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  await admin.end();
});
