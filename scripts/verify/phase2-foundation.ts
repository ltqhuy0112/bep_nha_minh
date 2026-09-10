import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import pg from "pg";
import { runner } from "node-pg-migrate";

const baseUrl = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ??
  "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh");
const databaseName = `bep_phase2_test_${randomUUID().replaceAll("-", "")}`;
const testUrl = new URL(baseUrl);
testUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: baseUrl.toString() });
const client = new pg.Client({ connectionString: testUrl.toString() });
let created = false;
let connected = false;
let checks = 0;

const requiredColumns: Record<string, string[]> = {
  customer_accounts: ["customer_id", "normalized_email", "email_verified_at", "password_hash", "status"],
  customer_identities: ["account_id", "provider", "provider_subject"],
  customer_sessions: ["account_id", "token_hash", "expires_at", "revoked_at"],
  customer_auth_tokens: ["account_id", "purpose", "token_hash", "target_email", "expires_at", "consumed_at", "revoked_at"],
  customer_addresses: ["customer_id", "recipient_name", "phone", "address_line", "ward", "district", "city", "is_default"],
  products: ["sku", "slug", "unit_price", "currency", "accepting_orders", "fulfillment_blocked", "price_version", "archived_at"],
  product_translations: ["product_id", "locale", "name", "description"],
  fulfillment_slots: ["slot_key", "label", "start_local_time", "end_local_time", "timezone", "cutoff_minutes", "enabled", "sort_order"],
  inventory_slots: ["product_id", "business_date", "slot_key", "capacity", "reserved", "committed", "version"],
  carts: ["account_id", "guest_token_hash", "business_date", "slot_key", "status", "expires_at", "version"],
  cart_items: ["cart_id", "product_id", "quantity"],
  orders: ["origin", "cart_id", "business_date", "slot_key", "accepted_at", "recipient_snapshot", "fulfillment_snapshot", "pricing_snapshot", "quantity_policy_snapshot", "snapshot_provenance", "payment_method", "review_status", "review_attempts", "next_review_at", "last_reviewed_at", "approval_source", "version"],
  order_items: ["product_id", "inventory_slot_id", "item_name", "item_snapshot"],
  inventory_reservations: ["order_item_id", "inventory_slot_id", "quantity", "status", "expires_at", "released_at"],
  payments: ["order_id", "method", "amount", "currency", "status", "collected_at", "collected_by_admin_id", "voided_at"],
  order_access_tokens: ["order_id", "purpose", "token_hash", "checkout_proof_hash", "expires_at", "consumed_at", "revoked_at"],
  idempotency_requests: ["scope", "key", "request_hash", "order_id", "response_code", "response_body", "expires_at"],
  order_validation_runs: ["order_id", "order_version", "rule_version", "outcome", "error_codes", "diagnostics", "started_at", "finished_at"],
  admin_alerts: ["order_id", "entity_type", "entity_id", "dedupe_key", "code", "severity", "status", "details", "acknowledged_by", "acknowledged_at", "resolved_by", "resolved_at", "resolution_reason"],
  order_status_history: ["actor_type", "actor_customer_id", "system_name", "actor_snapshot", "validation_run_id"],
  audit_logs: ["actor_type", "actor_customer_id", "system_name", "actor_snapshot", "correlation_id"],
  outbox_events: ["event_id", "aggregate_type", "aggregate_id", "aggregate_version", "event_type", "schema_version", "payload", "published_at", "attempts", "next_attempt_at", "lease_owner", "lease_until", "lease_token", "last_error", "quarantined_at"],
  processed_events: ["consumer_name", "event_id", "processed_at"]
};

async function migrate(direction: "up" | "down", count?: number, legacyOnly = false) {
  return runner({
    databaseUrl: testUrl.toString(),
    dir: path.resolve("migrations"),
    migrationsTable: "pgmigrations",
    direction,
    count,
    checkOrder: false,
    singleTransaction: true,
    ignorePattern: legacyOnly ? "20260910.*" : undefined,
    logger: { info() {}, warn() {}, error() {} }
  });
}

async function rejectsSql(sql: string, values: unknown[], code: string) {
  await assert.rejects(client.query(sql, values), (error: unknown) =>
    error instanceof Error && "code" in error && error.code === code);
  checks++;
}

async function verifySchema() {
  const columns = await client.query<{ table_name: string; column_name: string }>(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'"
  );
  const actual = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
  for (const [table, names] of Object.entries(requiredColumns)) {
    for (const name of names) assert(actual.has(`${table}.${name}`), `Missing ${table}.${name}`);
    checks++;
  }
  assert(!actual.has("cart_items.inventory_slot_id"));
  assert(!actual.has("inventory_slots.integrity_status"));
  assert(!actual.has("orders.lease_token"));
  const foreignKeys = await client.query<{ table_name: string; confdeltype: string }>(`
    SELECT conrelid::regclass::text AS table_name, confdeltype FROM pg_constraint
    WHERE contype='f' AND confrelid='orders'::regclass
      AND conrelid IN ('order_items'::regclass, 'order_status_history'::regclass)`);
  assert.equal(foreignKeys.rowCount, 2);
  assert(foreignKeys.rows.every((row) => row.confdeltype === "r"));
  checks++;
}

async function verifyFixtures(customerId: string, legacyOrderId: string) {
  const productId = randomUUID();
  await client.query(`INSERT INTO products
    (id,sku,slug,unit_price,currency,accepting_orders,fulfillment_blocked,price_version)
    VALUES ($1,'TEST-SKU','test-product',50000,'VND',true,false,1)`, [productId]);
  await assert.rejects(migrate("down", 4), /commerce data exists/i);
  assert.equal((await client.query("SELECT count(*)::int AS n FROM products WHERE id=$1", [productId])).rows[0].n, 1);
  checks++;
  await client.query(`INSERT INTO product_translations(product_id,locale,name,description)
    VALUES ($1,'vi','Test product','Test description')`, [productId]);
  await rejectsSql(`INSERT INTO product_translations(product_id,locale,name,description)
    VALUES ($1,'vi','Duplicate','Description')`, [productId], "23505");
  // These hours are disposable test fixtures, never production fulfillment configuration.
  for (let i = 0; i < 5; i++) await client.query(`INSERT INTO fulfillment_slots
    (slot_key,label,start_local_time,end_local_time,timezone,enabled,sort_order)
    VALUES ($1,'Test slot','10:00','12:00','Asia/Ho_Chi_Minh',true,$2)`, [`test-${i}`, i]);
  checks++;
  await rejectsSql(`INSERT INTO fulfillment_slots
    (slot_key,label,start_local_time,end_local_time,timezone,enabled,sort_order)
    VALUES ('overnight','Bad','22:00','02:00','Asia/Ho_Chi_Minh',true,9)`, [], "23514");
  const stockId = randomUUID();
  await client.query(`INSERT INTO inventory_slots
    (id,product_id,business_date,slot_key,capacity,reserved,committed)
    VALUES ($1,$2,'2030-01-01','test-0',1,0,0)`, [stockId, productId]);
  await rejectsSql("UPDATE inventory_slots SET reserved=2 WHERE id=$1", [stockId], "23514");
  await rejectsSql(`INSERT INTO inventory_slots(product_id,business_date,slot_key,capacity)
    VALUES ($1,'2030-01-01','test-0',1)`, [productId], "23505");
  const accountId = randomUUID();
  await client.query(`INSERT INTO customer_accounts(id,customer_id,normalized_email,status)
    VALUES ($1,$2,'test@example.invalid','ACTIVE')`, [accountId, customerId]);
  const cartId = randomUUID();
  await client.query(`INSERT INTO carts(id,account_id,status) VALUES ($1,$2,'ACTIVE')`, [cartId, accountId]);
  await rejectsSql("INSERT INTO carts(account_id,status) VALUES ($1,'ACTIVE')", [accountId], "23505");
  await client.query("INSERT INTO carts(account_id,status) VALUES ($1,'EXPIRED')", [accountId]);
  await rejectsSql("INSERT INTO carts(account_id,guest_token_hash) VALUES ($1,'both')", [accountId], "23514");
  await rejectsSql("UPDATE carts SET business_date='2030-01-01' WHERE id=$1", [cartId], "23514");
  await client.query("INSERT INTO cart_items(cart_id,product_id,quantity) VALUES ($1,$2,21)", [cartId, productId]);
  checks++; // Configurable caps must not be hard-coded as a row CHECK.
  await rejectsSql("INSERT INTO cart_items(cart_id,product_id,quantity) VALUES ($1,$2,1)", [cartId, productId], "23505");
  await rejectsSql("UPDATE cart_items SET quantity=0 WHERE cart_id=$1", [cartId], "23514");
  await rejectsSql(`INSERT INTO orders(order_code,customer_id,origin,subtotal_amount,total_amount)
    VALUES ('BAD-COMMERCE',$1,'COMMERCE',50000,50000)`, [customerId], "23514");
  await client.query(`INSERT INTO payments(order_id,method,amount,currency,status)
    VALUES ($1,'COD',50000,'VND','UNPAID')`, [legacyOrderId]);
  await rejectsSql(`INSERT INTO payments(order_id,method,amount,currency,status)
    VALUES ($1,'COD',50000,'VND','UNPAID')`, [legacyOrderId], "23505");
  await rejectsSql("UPDATE payments SET status='PAID' WHERE order_id=$1", [legacyOrderId], "23514");
  const adminId = randomUUID();
  await client.query(`INSERT INTO admin_users(id,email,password_hash,name,role)
    VALUES ($1,'schema-test@example.invalid','NOT-A-LOGIN-HASH','Schema test','ADMIN')`, [adminId]);
  await rejectsSql("UPDATE payments SET status='PAID',collected_at=now(),collected_by_admin_id=$2,voided_at=now() WHERE order_id=$1", [legacyOrderId, adminId], "23514");
  await rejectsSql("UPDATE payments SET status='VOID',voided_at=now(),collected_at=now() WHERE order_id=$1", [legacyOrderId], "23514");
  await rejectsSql("DELETE FROM orders WHERE id=$1", [legacyOrderId], "23503");
  await client.query(`INSERT INTO idempotency_requests(scope,key,request_hash,expires_at)
    VALUES ('test','key','hash',now()+interval '30 days')`);
  await rejectsSql(`INSERT INTO idempotency_requests(scope,key,request_hash,expires_at)
    VALUES ('test','key','hash2',now()+interval '30 days')`, [], "23505");
  const eventId = randomUUID();
  await client.query(`INSERT INTO processed_events(consumer_name,event_id,processed_at)
    VALUES ('test',$1,now())`, [eventId]);
  await rejectsSql(`INSERT INTO processed_events(consumer_name,event_id,processed_at)
    VALUES ('test',$1,now())`, [eventId], "23505");
  await client.query(`INSERT INTO outbox_events
    (event_id,aggregate_type,aggregate_id,aggregate_version,event_type,schema_version,payload,next_attempt_at)
    VALUES ($1,'order',$2,1,'order.created',1,'{}',now())`, [eventId, legacyOrderId]);
  await rejectsSql("UPDATE outbox_events SET lease_owner='partial' WHERE event_id=$1", [eventId], "23514");
  const tokenA = randomUUID();
  const tokenB = randomUUID();
  await client.query(`UPDATE outbox_events SET lease_owner='A',lease_until=now()-interval '1 second',lease_token=$2 WHERE event_id=$1`, [eventId, tokenA]);
  await client.query(`UPDATE outbox_events SET lease_owner='B',lease_until=now()+interval '1 minute',lease_token=$2 WHERE event_id=$1 AND lease_until<now()`, [eventId, tokenB]);
  const stale = await client.query("UPDATE outbox_events SET published_at=now() WHERE event_id=$1 AND lease_token=$2", [eventId, tokenA]);
  assert.equal(stale.rowCount, 0);
  checks++; // SQL contract test, not a claim that an outbox publisher exists.

  const commerceId = randomUUID();
  await client.query(`INSERT INTO orders
    (id,order_code,customer_id,origin,cart_id,business_date,slot_key,accepted_at,
      recipient_snapshot,fulfillment_snapshot,pricing_snapshot,quantity_policy_snapshot,
      snapshot_provenance,payment_method,review_status,subtotal_amount,total_amount)
    VALUES ($1,'COMMERCE-TEST',$2,'COMMERCE',$3,'2030-01-01','test-0',now(),
      $4,$5,$6,$7,'CHECKOUT','COD','QUEUED',50000,50000)`, [
    commerceId, customerId, cartId,
    { full_name: "Customer", phone: "0900000000", address_line: "Test address", city: "Test city" },
    { business_date: "2030-01-01", slot_key: "test-0", label: "Test slot", starts_at: "2030-01-01T10:00:00+07:00", ends_at: "2030-01-01T12:00:00+07:00", timezone: "Asia/Ho_Chi_Minh", cutoff_minutes: 120, cutoff_at: "2030-01-01T08:00:00+07:00" },
    { rule_version: "test", currency: "VND", subtotal_amount: 50000, delivery_fee: 0, discount_amount: 0, total_amount: 50000 },
    { version: "test", max_per_product: 20, max_total_quantity: 50 }
  ]);
  await rejectsSql("UPDATE orders SET payment_method=NULL WHERE id=$1", [commerceId], "23514");
  await rejectsSql("UPDATE orders SET snapshot_provenance=NULL WHERE id=$1", [commerceId], "23514");
  await rejectsSql("UPDATE orders SET recipient_snapshot='[]' WHERE id=$1", [commerceId], "23514");
  await rejectsSql("UPDATE orders SET approval_source='BOGUS' WHERE id=$1", [commerceId], "23514");
  const itemId = randomUUID();
  await client.query(`INSERT INTO order_items
    (id,order_id,product_id,inventory_slot_id,item_name,item_snapshot,quantity,unit_price,line_total)
    VALUES ($1,$2,$3,$4,'Test product','{"locale":"vi","price_version":1}',1,50000,50000)`, [itemId, commerceId, productId, stockId]);
  await client.query("BEGIN");
  await client.query(`INSERT INTO inventory_reservations(order_item_id,inventory_slot_id,quantity,status)
    VALUES ($1,$2,1,'HELD')`, [itemId, stockId]);
  await client.query("UPDATE inventory_slots SET reserved=1 WHERE id=$1", [stockId]);
  await client.query("ROLLBACK");
  assert.equal((await client.query("SELECT reserved FROM inventory_slots WHERE id=$1", [stockId])).rows[0].reserved, 0);
  assert.equal((await client.query("SELECT count(*)::int AS n FROM inventory_reservations WHERE order_item_id=$1", [itemId])).rows[0].n, 0);
  checks++;
  await assert.rejects(migrate("down", 1), /COMMERCE orders exist/);
  assert.equal((await client.query("SELECT count(*)::int AS n FROM orders WHERE id=$1", [commerceId])).rows[0].n, 1);
  checks++; // The safety guard is tested only against this disposable database.
}

async function main() {
  await admin.connect();
  // Only a freshly generated, validated database can be created or dropped here.
  assert(/^bep_phase2_test_[a-f0-9]{32}$/.test(databaseName));
  assert.notEqual(baseUrl.pathname, testUrl.pathname);
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  await migrate("up", undefined, true);
  await client.connect();
  connected = true;
  const customerId = randomUUID();
  const legacyOrderId = randomUUID();
  await client.query(`INSERT INTO customers(id,full_name,phone,address_line,city)
    VALUES ($1,'Legacy customer','0900000000','Legacy address','Test city')`, [customerId]);
  await client.query(`INSERT INTO orders(id,order_code,customer_id,subtotal_amount,total_amount)
    VALUES ($1,'LEGACY-TEST',$2,50000,50000)`, [legacyOrderId, customerId]);
  await client.query(`INSERT INTO order_items(order_id,item_name,quantity,unit_price,line_total)
    VALUES ($1,'Legacy item',1,50000,50000)`, [legacyOrderId]);
  const migrated = await migrate("up");
  assert.equal(migrated.length, 4);
  await verifySchema();
  const legacy = await client.query("SELECT origin,review_status,snapshot_provenance,total_amount FROM orders WHERE id=$1", [legacyOrderId]);
  assert.equal(legacy.rows[0].origin, "LEGACY");
  assert.equal(legacy.rows[0].review_status, null);
  assert.equal(legacy.rows[0].snapshot_provenance, "LEGACY_PROFILE_BACKFILL");
  assert.equal(legacy.rows[0].total_amount, 50000);
  assert.equal((await client.query("SELECT count(*)::int AS n FROM inventory_reservations")).rows[0].n, 0);
  assert.equal((await client.query("SELECT count(*)::int AS n FROM payments")).rows[0].n, 0);
  checks++;
  await migrate("down", 4);
  assert.equal((await client.query("SELECT total_amount FROM orders WHERE id=$1", [legacyOrderId])).rows[0].total_amount, 50000);
  assert.equal((await client.query("SELECT item_name FROM order_items WHERE order_id=$1", [legacyOrderId])).rows[0].item_name, "Legacy item");
  assert.equal((await migrate("up")).length, 4);
  assert.equal((await migrate("up")).length, 0);
  checks++;
  await client.query(`INSERT INTO orders(order_code,customer_id,subtotal_amount,total_amount)
    VALUES ('LEGACY-WRITER-AFTER-UPGRADE',$1,0,0)`, [customerId]);
  assert.equal((await client.query("SELECT origin FROM orders WHERE order_code='LEGACY-WRITER-AFTER-UPGRADE'")).rows[0].origin, "LEGACY");
  checks++;
  await verifyFixtures(customerId, legacyOrderId);
  console.log(`Phase 2 schema verification passed: ${checks} checks; isolated up/down/up, legacy preservation and SQL constraints.`);
  console.log("Checkout/auth/worker end-to-end scenarios remain planned, not implemented by this test.");
}

main().catch((error: unknown) => {
  console.error("Phase 2 schema verification failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
}).finally(async () => {
  if (connected) await client.end();
  if (created) {
    assert(/^bep_phase2_test_[a-f0-9]{32}$/.test(databaseName));
    await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  }
  await admin.end();
});
