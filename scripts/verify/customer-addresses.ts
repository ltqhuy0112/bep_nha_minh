import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import path from "node:path";
import pg from "pg";
import { runner } from "node-pg-migrate";
import { createApiServer } from "../../apps/api/src/runtime/http-server";
import { createCustomerAddressHandler } from "../../apps/api/src/features/customer-addresses/http";
import { tokenHash } from "../../apps/api/src/features/customer-auth/security";
import { syncLocations } from "../locations/sync";

const base = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh");
assert(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname), "Local isolated database only");
assert.notEqual(process.env.NODE_ENV, "production");
const name = `bep_addresses_test_${randomUUID().replaceAll("-", "")}`;
const url = new URL(base); url.pathname = `/${name}`;
const admin = new pg.Client({ connectionString: base.toString(), connectionTimeoutMillis: 3000 });
const pool = new pg.Pool({ connectionString: url.toString(), max: 6, connectionTimeoutMillis: 3000, statement_timeout: 10000 });
const config = { enabled: true, publicWebUrl: "http://localhost:3000", secureCookies: false, email: null,
  rateLimit: { key: randomBytes(32).toString("base64"), limit: 100, windowSeconds: 60 } };
const server = createApiServer({ customerAddressHandler: createCustomerAddressHandler(pool, config) });
let origin = "";
let created = false;
let checks = 0;
const input = { recipientName: "Test recipient", phone: "0912345678", addressLine: "1 Test Street", provinceCode: "01", wardCode: "00004", isDefault: false };
async function request(method: string, suffix: string, status: number, cookie?: string, body?: unknown, from = config.publicWebUrl) {
  const response = await fetch(`${origin}/api/v1/customer-addresses${suffix}`, { method,
    headers: { "content-type": "application/json", origin: from, ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  assert.equal(response.status, status, `Unexpected address response: ${method} ${suffix} (${data.error?.code ?? "success"})`);
  assert.equal(response.headers.get("cache-control"), "no-store"); checks++;
  return data.data;
}
async function fixture() {
  const customerId = randomUUID(), accountId = randomUUID(), token = randomBytes(32).toString("base64url");
  await pool.query("INSERT INTO customers(id,full_name,email) VALUES ($1,'Address fixture',$2)", [customerId, `${customerId}@example.invalid`]);
  await pool.query("INSERT INTO customer_accounts(id,customer_id,normalized_email) VALUES ($1,$2,$3)", [accountId, customerId, `${customerId}@example.invalid`]);
  await pool.query("INSERT INTO customer_sessions(account_id,token_hash,expires_at) VALUES ($1,$2,now()+interval '1 day')", [accountId, tokenHash(token)]);
  return { customerId, accountId, cookie: `bnm_customer_session=${token}` };
}
async function main() {
  await admin.connect();
  assert.match(name, /^bep_addresses_test_[a-f0-9]{32}$/);
  await admin.query(`CREATE DATABASE "${name}"`); created = true;
  await runner({ databaseUrl: url.toString(), dir: path.resolve("migrations"), direction: "up", migrationsTable: "pgmigrations", checkOrder: false,
    logger: { info() {}, warn() {}, error() {} } });
  const a = await fixture(), b = await fixture();
  await syncLocations(pool);
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await request("GET", "", 401);
  await request("GET", "", 401, "authjs.session-token=admin-is-not-customer");
  await request("POST", "", 403, a.cookie, input, "https://attacker.invalid");
  await request("POST", "", 400, a.cookie, { ...input, customerId: b.customerId });
  await request("POST", "", 400, a.cookie, { ...input, recipientName: " " });
  await request("POST", "", 400, a.cookie, { ...input, phone: "invalid" });
  await request("POST", "", 400, a.cookie, { ...input, district: "Legacy district" });
  await request("POST", "", 400, a.cookie, { ...input, city: "Forged name" });
  await request("POST", "", 400, a.cookie, { ...input, provinceCode: "79", wardCode: "00004" });
  await request("POST", "", 413, a.cookie, { ...input, addressLine: "a".repeat(17000) });
  await request("GET", "?customer_id=other", 400, a.cookie);
  await request("PATCH", "", 405, a.cookie, input);
  const first = await request("POST", "", 201, a.cookie, { ...input, isDefault: true });
  assert.equal(first.ward, "Phường Ba Đình");
  assert.equal(first.district, null);
  assert.equal(first.provinceCode, "01");
  const second = await request("POST", "", 201, a.cookie, input);
  await pool.query(`CREATE FUNCTION test_address_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.entity_type='CUSTOMER_ADDRESS' THEN RAISE EXCEPTION 'test rollback'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER test_address_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_address_audit_failure()`);
  await request("POST", "", 500, a.cookie, { ...input, isDefault: true });
  await pool.query("DROP TRIGGER test_address_audit_failure ON audit_logs; DROP FUNCTION test_address_audit_failure()");
  const afterRollback = (await request("GET", "", 200, a.cookie)).items;
  assert.equal(afterRollback.length, 2);
  assert.equal(afterRollback.find((item: { isDefault: boolean }) => item.isDefault).id, first.id, "Failed audit rolls back the default change and insert");
  assert.equal((await request("GET", "", 200, b.cookie)).items.length, 0);
  for (const [method, suffix] of [["PUT", `/${first.id}`], ["DELETE", `/${first.id}`], ["PUT", `/${first.id}/default`]]) {
    await request(method, suffix, 404, b.cookie, method === "PUT" && !suffix.endsWith("default") ? input : {});
  }
  await Promise.all([request("PUT", `/${first.id}/default`, 200, a.cookie, {}), request("PUT", `/${second.id}/default`, 200, a.cookie, {})]);
  const list = (await request("GET", "", 200, a.cookie)).items;
  assert.equal(list.filter((item: { isDefault: boolean }) => item.isDefault).length, 1);
  await request("PUT", `/${first.id}`, 200, a.cookie, { ...input, wardCode: "00008", isDefault: true });
  const foreignBefore = await pool.query("SELECT row_to_json(c) AS value FROM customers c WHERE id=$1", [a.customerId]);
  await request("DELETE", `/${first.id}`, 200, a.cookie, {});
  await request("DELETE", `/${first.id}`, 404, a.cookie, {});
  const remaining = (await request("GET", "", 200, a.cookie)).items;
  assert.equal(remaining.length, 1); assert.equal(remaining[0].isDefault, false, "No implicit default promotion");
  assert.deepEqual((await pool.query("SELECT row_to_json(c) AS value FROM customers c WHERE id=$1", [a.customerId])).rows, foreignBefore.rows);
  const logs = await pool.query("SELECT metadata,actor_customer_id FROM audit_logs WHERE entity_type='CUSTOMER_ADDRESS'");
  assert(logs.rowCount! >= 6); assert(logs.rows.every((row) => row.actor_customer_id === a.customerId && JSON.stringify(row.metadata) === "{}"));
  await pool.query("UPDATE customer_accounts SET status='DISABLED' WHERE id=$1", [a.accountId]);
  await request("GET", "", 401, a.cookie);
  await request("PUT", `/${second.id}`, 401, a.cookie, input);
  await pool.query("UPDATE customer_sessions SET revoked_at=now() WHERE account_id=$1", [b.accountId]);
  await request("GET", "", 401, b.cookie);
  const expired = await fixture();
  await pool.query("UPDATE customer_sessions SET created_at=now()-interval '2 days', expires_at=now()-interval '1 day' WHERE account_id=$1", [expired.accountId]);
  await request("POST", "", 401, expired.cookie, input);
  const limited = await fixture();
  for (let i = 0; i < 101; i++) await request("DELETE", `/${randomUUID()}`, i === 100 ? 429 : 404, limited.cookie, {});
  console.log(`PASS: ${checks} address HTTP checks, ownership, default concurrency, rollback, audit, validation, revoked/expired sessions and rate limiting`);
}
void main().catch((error: unknown) => { console.error(error instanceof assert.AssertionError ? error.message : "FAIL: isolated customer-address verification"); process.exitCode = 1; }).finally(async () => {
  server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
  if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.end();
});
