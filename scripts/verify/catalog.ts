import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import path from "node:path";
import pg from "pg";
import { runner } from "node-pg-migrate";
import { createApiServer } from "../../apps/api/src/runtime/http-server";
import { configureApprovedFulfillmentSlots } from "../db/fulfillment-slots";

const baseUrl = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ??
  "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh");
const databaseName = `bep_catalog_test_${randomUUID().replaceAll("-", "")}`;
const testUrl = new URL(baseUrl);
testUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: baseUrl.toString() });
const client = new pg.Client({ connectionString: testUrl.toString() });
let created = false;
let connected = false;
let checks = 0;
const server = createApiServer({ catalogDatabase: client });
let origin = "";

async function request(route: string, expected = 200, method = "GET") {
  const response = await fetch(`${origin}/api/v1/catalog/${route}`, { method });
  const body = await response.json();
  assert.equal(response.status, expected, `${route}: ${JSON.stringify(body)}`);
  assert.equal(body.version, "v1");
  checks++;
  return { response, body };
}

async function fixtures() {
  const product = await client.query<{ id: string }>(`
    INSERT INTO products(sku,slug,unit_price,accepting_orders)
    VALUES ('TEST-A','test-a',59000,true),('TEST-B','test-b',69000,false),
      ('TEST-HIDDEN','hidden',1000,false),('TEST-UNTRANSLATED','untranslated',1000,true)
    RETURNING id`);
  for (const [index, row] of product.rows.entries()) {
    await client.query(`INSERT INTO product_translations(product_id,locale,name,description)
      VALUES ($1,'vi',$2,'Vietnamese description')`, [row.id, `VI ${index}`]);
    if (index !== 3) await client.query(`INSERT INTO product_translations(product_id,locale,name,description)
      VALUES ($1,'en',$2,'English description')`, [row.id, `EN ${index}`]);
  }
  await client.query("UPDATE products SET archived_at=now() WHERE slug='hidden'");
  return product.rows[0].id;
}

async function main() {
  await admin.connect();
  assert(/^bep_catalog_test_[a-f0-9]{32}$/.test(databaseName));
  assert.notEqual(baseUrl.pathname, testUrl.pathname);
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  await runner({ databaseUrl: testUrl.toString(), dir: path.resolve("migrations"), direction: "up",
    migrationsTable: "pgmigrations", checkOrder: false, singleTransaction: true,
    logger: { info() {}, warn() {}, error() {} } });
  await client.connect();
  connected = true;
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  assert.deepEqual((await request("products?locale=vi")).body.data.items, []);
  assert.deepEqual((await request("fulfillment-slots?date=2099-01-01")).body.data.items, []);
  await client.query("BEGIN");
  try {
    assert.equal(await configureApprovedFulfillmentSlots(client), 4);
    assert.equal(await configureApprovedFulfillmentSlots(client), 0);
    const approved = (await request("fulfillment-slots?date=2099-01-01")).body.data.items;
    assert.deepEqual(approved.map((slot: { slotKey: string }) => slot.slotKey), ["LUNCH_1", "LUNCH_2", "DINNER_1", "DINNER_2"]);
    assert.deepEqual(approved.map((slot: { cutoffAt: string }) => new Date(slot.cutoffAt).toISOString()), [
      "2099-01-01T01:30:00.000Z", "2099-01-01T03:00:00.000Z", "2099-01-01T08:00:00.000Z", "2099-01-01T09:30:00.000Z"
    ]);
    await client.query("UPDATE fulfillment_slots SET enabled=false WHERE slot_key='LUNCH_1'");
    assert.equal(await configureApprovedFulfillmentSlots(client), 0);
    assert.equal((await client.query("SELECT enabled FROM fulfillment_slots WHERE slot_key='LUNCH_1'")).rows[0].enabled, false);
    await client.query("UPDATE fulfillment_slots SET start_local_time='11:00' WHERE slot_key='LUNCH_1'");
    await assert.rejects(configureApprovedFulfillmentSlots(client), /Conflicting schedule for LUNCH_1/);
  } finally {
    await client.query("ROLLBACK");
  }
  assert.equal((await client.query("SELECT count(*)::int AS n FROM fulfillment_slots")).rows[0].n, 0);
  const productId = await fixtures();
  const list = (await request("products?locale=vi")).body.data;
  assert.equal(list.total, 3);
  assert(list.items.every((item: { name: string }) => item.name.startsWith("VI")));
  assert.equal((await request("products?locale=en")).body.data.total, 2);
  const first = (await request("products?locale=vi&page=1&pageSize=1")).body.data;
  const second = (await request("products?locale=vi&page=2&pageSize=1")).body.data;
  assert.equal(first.items.length, 1);
  assert.notEqual(first.items[0].slug, second.items[0].slug);
  assert.equal(first.total, second.total);
  assert.equal((await request("products/test-b?locale=vi")).body.data.acceptingOrders, false);
  assert.equal((await request("products/test-a?locale=en")).body.data.name, "EN 0");
  await request("products/hidden?locale=vi", 404);
  await request("products/untranslated?locale=en", 404);
  assert.equal((await request("products/missing?locale=vi", 404)).body.error.code, "PRODUCT_NOT_FOUND");
  for (const query of ["", "locale=fr", "locale=vi&locale=en", "locale=vi&page=0", "locale=vi&pageSize=51", "locale=vi&page=9007199254740991&pageSize=50", "locale=vi&page=1.5", "locale=vi&unknown=x"]) {
    await request(`products?${query}`, 400);
  }
  for (const date of ["2026-02-30", "2026-13-01", "09-10-2026", "2026-2-1"]) {
    await request(`fulfillment-slots?date=${date}`, 400);
  }
  const method = await request("products?locale=vi", 405, "POST");
  assert.equal(method.response.headers.get("allow"), "GET");
  assert.match(method.response.headers.get("cache-control") ?? "", /no-store/);
  await client.query("UPDATE products SET slug='availability' WHERE slug='test-b'");
  assert.equal((await request("products/availability?locale=vi")).body.data.slug, "availability");
  await client.query("UPDATE products SET slug=$1 WHERE slug='availability'", ["cơm_gà"]);
  assert.equal((await request(`products/${encodeURIComponent("cơm_gà")}?locale=vi`)).body.data.slug, "cơm_gà");
  await request("products/test-a/availability?locale=vi&date=2099-01-01", 400);
  assert.equal((await request("products/test-a/availability?locale=vi&date=2099-01-01&slotKey=missing", 404)).body.error.code, "FULFILLMENT_SLOT_NOT_FOUND");

  // Slot times below exist only in this disposable database, not in business configuration.
  await client.query(`INSERT INTO fulfillment_slots(slot_key,label,start_local_time,end_local_time,cutoff_minutes,enabled,sort_order)
    VALUES ('late','Late','16:00','18:00',120,true,2),
      ('early','Early','10:00','12:00',120,true,1),
      ('disabled','Disabled','10:00','12:00',120,false,0)`);
  const slots = (await request("fulfillment-slots?date=2099-01-01")).body.data.items;
  assert.deepEqual(slots.map((slot: { slotKey: string }) => slot.slotKey), ["early", "late"]);
  assert.equal(new Date(slots[0].cutoffAt).toISOString(), "2099-01-01T01:00:00.000Z");
  assert.equal(slots[0].cutoffPassed, false);
  assert.equal((await request("fulfillment-slots?date=2000-01-01")).body.data.items[0].cutoffPassed, true);
  const availabilityPath = "products/test-a/availability?locale=vi&date=2099-01-01&slotKey=early";
  const unconfigured = (await request(availabilityPath)).body.data;
  assert.equal(unconfigured.inventoryConfigured, false);
  assert.equal(unconfigured.availableQuantity, 0);
  await client.query(`INSERT INTO inventory_slots(product_id,business_date,slot_key,capacity,reserved,committed)
    VALUES ($1,'2099-01-01','early',20,3,5)`, [productId]);
  const available = (await request(availabilityPath)).body.data;
  assert.equal(available.availableQuantity, 12);
  assert.equal(available.inventoryConfigured, true);
  await client.query("UPDATE products SET fulfillment_blocked=true WHERE id=$1", [productId]);
  const blocked = (await request(availabilityPath)).body.data;
  assert.equal(blocked.fulfillmentBlocked, true);
  assert.equal(blocked.availableQuantity, 12);
  await request("products/test-a/availability?locale=vi&date=2099-01-01&slotKey=disabled", 404);

  await client.query("BEGIN");
  try {
    const date = (await client.query(`SELECT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD') AS date`)).rows[0].date;
    await client.query(`INSERT INTO fulfillment_slots(slot_key,label,start_local_time,end_local_time,cutoff_minutes,enabled)
      VALUES ('boundary','Boundary',(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::time,'23:59:59.999999',0,true)`);
    const boundary = (await request(`fulfillment-slots?date=${date}`)).body.data.items.find((slot: { slotKey: string }) => slot.slotKey === "boundary");
    assert.equal(boundary.cutoffPassed, true, "Exact cutoff is closed, using database transaction time");
  } finally {
    await client.query("ROLLBACK");
  }
  const stock = (await client.query("SELECT capacity,reserved,committed FROM inventory_slots WHERE product_id=$1", [productId])).rows[0];
  assert.deepEqual(stock, { capacity: 20, reserved: 3, committed: 5 });
  const before = (await client.query("SELECT count(*)::int AS n FROM orders")).rows[0].n;
  assert.equal(before, 0);
  const document = await (await fetch(`${origin}/api/v1/openapi.json`)).json();
  assert(document.paths["/api/v1/catalog/products"]);
  await client.query("ALTER TABLE products RENAME TO unavailable_products");
  const failure = await request("products?locale=vi", 500);
  assert.equal(failure.body.error.code, "INTERNAL_ERROR");
  assert(!JSON.stringify(failure.body).includes("relation"));
  console.log(`Catalog verification passed: ${checks} HTTP checks plus SQL assertions; isolated PostgreSQL, no writes by catalog endpoints.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Catalog verification failed.");
  process.exitCode = 1;
}).finally(async () => {
  if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (connected) await client.end();
  if (created) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  await admin.end();
});
