import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import pg from "pg";
import { runner } from "node-pg-migrate";

const baseUrl = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ??
  "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh");
const databaseName = `bep_customer_auth_schema_${randomUUID().replaceAll("-", "")}`;
const testUrl = new URL(baseUrl);
testUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: baseUrl.toString() });
const client = new pg.Client({ connectionString: testUrl.toString() });
const hash = "a".repeat(64);
let created = false;
let connected = false;
let checks = 0;

async function migrate(direction: "up" | "down", count?: number) {
  return runner({
    databaseUrl: testUrl.toString(), dir: path.resolve("migrations"), migrationsTable: "pgmigrations",
    direction, count, checkOrder: false, singleTransaction: true,
    logger: { info() {}, warn() {}, error() {} }
  });
}

async function rejects(sql: string, values: unknown[] = [], expression = /./, label = "constraint") {
  await assert.rejects(client.query(sql, values), expression, label);
  checks++;
}

async function verifySchema() {
  const columns = await client.query<{ table_name: string; column_name: string }>(`
    SELECT table_name,column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('customer_oauth_transactions','customer_auth_rate_limits')`);
  const actual = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
  for (const name of ["id", "provider", "state_hash", "browser_binding_hash", "pkce_ciphertext", "redirect_uri", "locale", "created_at", "expires_at", "consumed_at"]) {
    assert(actual.has(`customer_oauth_transactions.${name}`), `Missing OAuth column ${name}`);
  }
  for (const name of ["action", "key_hash", "window_started_at", "window_expires_at", "attempt_count"]) {
    assert(actual.has(`customer_auth_rate_limits.${name}`), `Missing limiter column ${name}`);
  }
  const indexes = await client.query<{ indexname: string }>(`
    SELECT indexname FROM pg_indexes WHERE schemaname='public'
      AND tablename IN ('customer_oauth_transactions','customer_auth_rate_limits')`);
  const names = new Set(indexes.rows.map((row) => row.indexname));
  assert(names.has("idx_customer_oauth_transactions_expires_at"));
  assert(names.has("idx_customer_auth_rate_limits_window_expires_at"));
  checks += 3;
}

async function verifyContracts() {
  const transaction = await client.query<{ id: string; created_at: Date; expires_at: Date }>(`
    INSERT INTO customer_oauth_transactions(provider,state_hash,browser_binding_hash,pkce_ciphertext,redirect_uri,locale)
    VALUES ('GOOGLE',$1,$2,'{"iv":"a","tag":"b","data":"c"}','https://example.invalid/account/callback','vi')
    RETURNING id,created_at,expires_at`, [hash, "b".repeat(64)]);
  const row = transaction.rows[0];
  assert.equal(row.expires_at.getTime() - row.created_at.getTime(), 600_000);
  checks++;
  await rejects(`INSERT INTO customer_oauth_transactions(provider,state_hash,browser_binding_hash,redirect_uri,locale)
    VALUES ('GOOGLE',$1,$2,'https://example.invalid/callback','vi')`, [hash, "c".repeat(64)], /duplicate/i, "duplicate state must be rejected");
  await rejects(`INSERT INTO customer_oauth_transactions(provider,state_hash,browser_binding_hash,redirect_uri,locale)
    VALUES ('APPLE',$1,$2,'https://example.invalid/callback','vi')`, ["d".repeat(64), "e".repeat(64)], /./, "unknown provider must be rejected");
  await rejects(`INSERT INTO customer_oauth_transactions(provider,state_hash,browser_binding_hash,redirect_uri,locale)
    VALUES ('GOOGLE','A',$1,'https://example.invalid/callback','vi')`, ["f".repeat(64)], /./, "non-hex state hash must be rejected");
  await rejects(`INSERT INTO customer_oauth_transactions(provider,state_hash,browser_binding_hash,redirect_uri,locale)
    VALUES ('GOOGLE',$1,$2,'https://user:secret@example.invalid/callback','vi')`, ["1".repeat(64), "2".repeat(64)], /./, "URI credentials must be rejected");
  await rejects(`INSERT INTO customer_oauth_transactions(provider,state_hash,browser_binding_hash,pkce_ciphertext,redirect_uri,locale)
    VALUES ('GOOGLE',$1,$2,'{"iv":"a"}','https://example.invalid/callback','vi')`, ["3".repeat(64), "4".repeat(64)], /./, "incomplete PKCE envelope must be rejected");
  await rejects(`UPDATE customer_oauth_transactions SET consumed_at=expires_at+interval '1 second' WHERE id=$1`, [row.id], /./, "consumed time after expiry must be rejected");

  await client.query(`WITH instant AS (SELECT clock_timestamp() AS value)
    INSERT INTO customer_auth_rate_limits(action,key_hash,window_started_at,window_expires_at,attempt_count)
    SELECT 'LOGIN',$1,value,value+interval '1 minute',1 FROM instant
    RETURNING window_started_at`, ["5".repeat(64)]);
  await rejects(`INSERT INTO customer_auth_rate_limits
    (action,key_hash,window_started_at,window_expires_at,attempt_count)
    SELECT action,key_hash,window_started_at,window_expires_at,attempt_count
    FROM customer_auth_rate_limits WHERE action='LOGIN' AND key_hash=$1`, ["5".repeat(64)], /duplicate/i, "duplicate limiter bucket must be rejected");
  await rejects(`INSERT INTO customer_auth_rate_limits
    (action,key_hash,window_started_at,window_expires_at,attempt_count)
    VALUES ('login',$1,'2030-01-01T00:00:00Z','2030-01-01T00:01:00Z',1)`, ["6".repeat(64)], /./, "lowercase action must be rejected");
  await rejects(`INSERT INTO customer_auth_rate_limits
    (action,key_hash,window_started_at,window_expires_at,attempt_count)
    VALUES ('LOGIN','BAD','2030-01-01T00:00:00Z','2030-01-01T00:01:00Z',1)`, [], /./, "non-hex limiter key must be rejected");
  await rejects(`INSERT INTO customer_auth_rate_limits
    (action,key_hash,window_started_at,window_expires_at,attempt_count)
    VALUES ('LOGIN',$1,'2030-01-01T00:00:00Z','2030-01-01T00:01:00Z',0)`, ["7".repeat(64)], /./, "zero attempts must be rejected");
  checks++;
}

async function verifySafeDown() {
  await assert.rejects(migrate("down", 1), /active unconsumed OAuth transactions/i);
  checks++;
  await client.query("UPDATE customer_oauth_transactions SET consumed_at=clock_timestamp() WHERE state_hash=$1", [hash]);
  await assert.rejects(migrate("down", 1), /active limiter windows/i);
  checks++;
  await client.query(`UPDATE customer_auth_rate_limits
    SET window_started_at='2000-01-01T00:00:00Z', window_expires_at='2000-01-01T00:01:00Z'`);
  await migrate("down", 1);
  const tables = await client.query<{ table_name: string }>(`SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('customer_oauth_transactions','customer_auth_rate_limits')`);
  assert.equal(tables.rowCount, 0);
  checks++;
}

async function main() {
  await admin.connect();
  assert(/^bep_customer_auth_schema_[a-f0-9]{32}$/.test(databaseName));
  assert.notEqual(baseUrl.pathname, testUrl.pathname);
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  await migrate("up");
  await client.connect();
  connected = true;
  await verifySchema();
  await verifyContracts();
  await verifySafeDown();
  assert.equal((await migrate("up", 1)).length, 1);
  assert.equal((await migrate("up", 1)).length, 0);
  checks++;
  console.log(`Customer auth schema verification passed: ${checks} checks; isolated up/down/up and rollback guards.`);
}

main().catch((error: unknown) => {
  console.error("Customer auth schema verification failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
}).finally(async () => {
  if (connected) await client.end();
  if (created) {
    assert(/^bep_customer_auth_schema_[a-f0-9]{32}$/.test(databaseName));
    await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  }
  await admin.end();
});
