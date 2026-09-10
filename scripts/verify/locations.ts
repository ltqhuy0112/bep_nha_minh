import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import path from "node:path";
import pg from "pg";
import { runner } from "node-pg-migrate";
import { createLocationHandler } from "../../apps/api/src/features/locations/http";
import { createApiServer } from "../../apps/api/src/runtime/http-server";
import { syncLocations } from "../locations/sync";

const base = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh");
assert(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));
assert.notEqual(process.env.NODE_ENV, "production");
const name = `bep_locations_test_${randomUUID().replaceAll("-", "")}`;
const url = new URL(base); url.pathname = `/${name}`;
const admin = new pg.Client({ connectionString: base.toString() });
const pool = new pg.Pool({ connectionString: url.toString(), statement_timeout: 10000 });
let queryCount = 0;
const observedPool = new Proxy(pool, { get(target, key) {
  if (key === "query") return (...args: Parameters<pg.Pool["query"]>) => { queryCount++; return target.query(...args); };
  return Reflect.get(target, key);
} });
const server = createApiServer({ locationHandler: createLocationHandler(observedPool) });
let created = false;
const migrate = (direction: "up" | "down") => runner({ databaseUrl: url.toString(), dir: path.resolve("migrations"),
  direction, ...(direction === "down" ? { count: 1 } : {}), migrationsTable: "pgmigrations", checkOrder: false,
  logger: { info() {}, warn() {}, error() {} } });

async function main() {
  await admin.connect();
  assert.match(name, /^bep_locations_test_[a-f0-9]{32}$/);
  await admin.query(`CREATE DATABASE "${name}"`); created = true;
  await migrate("up"); await migrate("down");
  const customer = randomUUID();
  await pool.query("INSERT INTO customers(id,full_name,email) VALUES ($1,'Location fixture','location@example.invalid')", [customer]);
  const legacy = await pool.query(`INSERT INTO customer_addresses(customer_id,recipient_name,phone,address_line,city,ward,district)
    VALUES ($1,'Fixture','0912345678','1 Test','Old province','Old ward','Old district') RETURNING id`, [customer]);
  await pool.query("INSERT INTO orders(order_code,customer_id,total_amount) VALUES ('LOC-LEGACY',$1,0)", [customer]);
  await migrate("up"); await migrate("down"); await migrate("up");
  assert.deepEqual((await pool.query("SELECT city,ward,district,province_code FROM customer_addresses WHERE id=$1", [legacy.rows[0].id])).rows[0],
    { city: "Old province", ward: "Old ward", district: "Old district", province_code: null });
  await pool.query("UPDATE customer_addresses SET is_default=true WHERE id=$1", [legacy.rows[0].id]);
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/locations/provinces`;
  const unavailable = await fetch(origin);
  assert.equal(unavailable.status, 503); assert.equal(unavailable.headers.get("cache-control"), "no-store");
  await syncLocations(pool); await syncLocations(pool);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM location_datasets")).rows[0].n, 1);
  const response = await fetch(origin);
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "public, max-age=300");
  const provinces = (await response.json()).data;
  assert.equal(provinces.items.length, 34);
  const before = queryCount;
  await Promise.all(Array.from({ length: 10 }, () => fetch(origin)));
  assert.equal(queryCount, before, "Reference cache avoids repeated database queries");
  const wards = (await (await fetch(`${origin}/01/wards`)).json()).data.items;
  assert(wards.some((ward: { code: string }) => ward.code === "00004"));
  assert.equal((await fetch(`${origin}/99/wards`)).status, 404);
  assert.equal((await fetch(`${origin}/1/wards`)).status, 404);
  assert.equal((await fetch(`${origin}?unexpected=1`)).status, 400);
  assert.equal((await fetch(origin, { method: "POST" })).status, 405);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM location_wards")).rows[0].n, 3321);
  await assert.rejects(pool.query("SELECT resolve_vn_location('79','00004')"), { code: "22023" });
  await assert.rejects(pool.query(`INSERT INTO customer_addresses(customer_id,recipient_name,phone,address_line,city)
    VALUES ($1,'Fixture','0912345678','Test','Free text')`, [customer]), { code: "22023" });
  const address = (await pool.query(`INSERT INTO customer_addresses(customer_id,recipient_name,phone,address_line,city,province_code,ward_code)
    VALUES ($1,'Fixture','0912345678','Test','FORGED','01','00004') RETURNING *`, [customer])).rows[0];
  assert.equal(address.city, provinces.items.find((p: { code: string }) => p.code === "01").name);
  assert.equal(address.district, null); assert.equal(address.ward_code, "00004");
  await pool.query("INSERT INTO fulfillment_slots(slot_key,label,start_local_time,end_local_time) VALUES ('TEST','Test','10:30','12:00')");
  const cart = (await pool.query("INSERT INTO carts(guest_token_hash) VALUES ($1) RETURNING id", ["a".repeat(64)])).rows[0].id;
  const order = (await pool.query(`INSERT INTO orders(order_code,customer_id,total_amount,origin,cart_id,business_date,slot_key,accepted_at,
    recipient_snapshot,fulfillment_snapshot,pricing_snapshot,quantity_policy_snapshot,snapshot_provenance,payment_method,review_status)
    VALUES ('LOC-COMMERCE',$1,0,'COMMERCE',$2,current_date,'TEST',now(),
    '{"province_code":"01","ward_code":"00004","city":"FORGED","recipient_name":"Original"}', '{}','{}','{}','CHECKOUT','COD','QUEUED') RETURNING id,recipient_snapshot`, [customer, cart])).rows[0];
  assert.equal(order.recipient_snapshot.city, address.city);
  assert.equal(order.recipient_snapshot.ward_code, "00004");
  assert.equal(order.recipient_snapshot.district, null);
  await pool.query("UPDATE location_provinces SET name_vi='Changed catalog' WHERE code='01'");
  await pool.query("UPDATE customers SET full_name='Changed profile' WHERE id=$1", [customer]);
  assert.deepEqual((await pool.query("SELECT recipient_snapshot FROM orders WHERE id=$1", [order.id])).rows[0].recipient_snapshot, order.recipient_snapshot);
  assert.equal((await pool.query("SELECT city FROM customer_addresses WHERE id=$1", [address.id])).rows[0].city, address.city);
  await assert.rejects(pool.query("UPDATE orders SET recipient_snapshot='{}' WHERE id=$1", [order.id]), { code: "23514" });
  await assert.rejects(migrate("down"), /Rollback refused/);
  assert.equal((await pool.query("SELECT origin FROM orders WHERE order_code='LOC-LEGACY'")).rows[0].origin, "LEGACY");
  console.log("PASS: migration up/down/up, legacy preservation, offline idempotent sync, 34/3321 reference data, API/cache, province membership, canonical/immutable order snapshots and rollback guard");
}
void main().catch((error: unknown) => {
  console.error(error instanceof assert.AssertionError ? error.message : "FAIL: isolated location verification", error instanceof pg.DatabaseError ? { code: error.code, constraint: error.constraint, message: error.message } : undefined); process.exitCode = 1;
}).finally(async () => {
  server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
  if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.end();
});
