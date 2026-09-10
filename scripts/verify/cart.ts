import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import path from "node:path";
import pg from "pg";
import { runner } from "node-pg-migrate";
import { createApiServer } from "../../apps/api/src/runtime/http-server";
import { createCartHandler } from "../../apps/api/src/features/cart/http";
import { tokenHash } from "../../apps/api/src/features/customer-auth/security";

const base = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh");
assert(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname), "Local isolated database only");
assert.notEqual(process.env.NODE_ENV, "production");
const name = `bep_cart_test_${randomUUID().replaceAll("-", "")}`;
const url = new URL(base); url.pathname = `/${name}`;
const admin = new pg.Client({ connectionString: base.toString(), connectionTimeoutMillis: 3000 });
const pool = new pg.Pool({ connectionString: url.toString(), max: 12, connectionTimeoutMillis: 3000, statement_timeout: 10000 });
const serveUi = process.argv.includes("--serve-ui");
const configuredPort = process.env.CART_VERIFY_UI_PORT;
const servePort = configuredPort === undefined ? 3101 : Number(configuredPort);
if (serveUi && (!Number.isSafeInteger(servePort) || servePort < 1 || servePort > 65535)) throw new Error("Invalid CART_VERIFY_UI_PORT");
const config = { enabled: true, publicWebUrl: serveUi ? "http://localhost:3100" : "http://localhost:3000", secureCookies: false, email: null,
  rateLimit: { key: randomBytes(32).toString("base64"), limit: 1000, windowSeconds: 60 } };
const server = createApiServer({ catalogDatabase: pool, cartHandler: createCartHandler(pool, config, { perProduct: 20, total: 50 }) });
const sessionName = "bnm_customer_session", guestName = "bnm_guest_cart";
let origin = "";
let created = false;
let checks = 0;
let stage = "bootstrap";

type Cart = { id: string | null; version: number; owner: "guest" | "account"; businessDate: string | null; slotKey: string | null;
  items: Array<{ slug: string; quantity: number }>; totalQuantity: number; guestCart: Cart | null };
type Reply = { data: Cart; cookie: string | null; code: string | null };

function cookie(name: string, token: string) { return `${name}=${token}`; }
async function request(method: "GET" | "POST", expected: number | number[], options: { cookie?: string; body?: unknown; query?: string; from?: string } = {}): Promise<Reply> {
  const response = await fetch(`${origin}/api/v1/cart${options.query ?? (method === "GET" ? "?locale=vi" : "")}`, {
    method, headers: { "content-type": "application/json", origin: options.from ?? config.publicWebUrl, ...(options.cookie ? { cookie: options.cookie } : {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: AbortSignal.timeout(15000)
  });
  const value = await response.json() as { data?: Cart; error?: { code?: string } };
  assert((Array.isArray(expected) ? expected : [expected]).includes(response.status), `Unexpected cart response: ${method} (${value.error?.code ?? "success"})`);
  assert.equal(response.headers.get("cache-control"), "no-store"); checks++;
  return { data: value.data as Cart, cookie: response.headers.get("set-cookie"), code: value.error?.code ?? null };
}
function command(action: "initialize" | "set-item" | "set-slot" | "merge", values: Record<string, unknown> = {}) {
  return { action, locale: "vi", ...values };
}
async function fixtureAccount() {
  const customerId = randomUUID(), accountId = randomUUID(), token = randomBytes(32).toString("base64url");
  const email = `${customerId}@example.invalid`;
  await pool.query("INSERT INTO customers(id,full_name,email) VALUES ($1,'Cart fixture',$2)", [customerId, email]);
  await pool.query("INSERT INTO customer_accounts(id,customer_id,normalized_email) VALUES ($1,$2,$3)", [accountId, customerId, email]);
  await pool.query("INSERT INTO customer_sessions(account_id,token_hash,expires_at) VALUES ($1,$2,now()+interval '1 day')", [accountId, tokenHash(token)]);
  return { accountId, token, cookie: cookie(sessionName, token) };
}
async function fixtureSchema() {
  const required: Record<string, string[]> = {
    carts: ["id", "account_id", "guest_token_hash", "business_date", "slot_key", "status", "expires_at", "version"],
    cart_items: ["cart_id", "product_id", "quantity"], products: ["id", "sku", "slug", "unit_price", "accepting_orders", "fulfillment_blocked", "price_version"],
    product_translations: ["product_id", "locale", "name", "description"], fulfillment_slots: ["slot_key", "start_local_time", "timezone", "cutoff_minutes", "enabled"],
    inventory_slots: ["product_id", "business_date", "slot_key", "capacity", "reserved", "committed"], customer_sessions: ["account_id", "token_hash", "expires_at", "revoked_at"]
  };
  const result = await pool.query<{ table_name: string; column_name: string }>("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1)", [Object.keys(required)]);
  for (const [table, columns] of Object.entries(required)) for (const column of columns) {
    assert(result.rows.some((row) => row.table_name === table && row.column_name === column), `Fixture missing column: ${table}.${column}`);
  }
}
async function fixtures() {
  const future = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const past = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  const products = ["bep-cart-a", "bep-cart-b", "bep-cart-c"].map((slug, index) => ({ id: randomUUID(), slug, sku: `CART-${index + 1}` }));
  for (const [index, product] of products.entries()) {
    await pool.query("INSERT INTO products(id,sku,slug,unit_price,accepting_orders) VALUES ($1,$2,$3,$4,true)", [product.id, product.sku, product.slug, 10000 + index]);
    await pool.query("INSERT INTO product_translations(product_id,locale,name,description) VALUES ($1,'vi',$2,'Fixture'),($1,'en',$3,'Fixture')", [product.id, `Cart ${index + 1}`, `Cart ${index + 1}`]);
  }
  await pool.query("INSERT INTO fulfillment_slots(slot_key,label,start_local_time,end_local_time,enabled,cutoff_minutes) VALUES ('cart-future','Future','23:00','23:30',true,0),('cart-cutoff','Cutoff','23:00','23:30',true,0)");
  for (const product of products) await pool.query("INSERT INTO inventory_slots(product_id,business_date,slot_key,capacity) VALUES ($1,$2,'cart-future',100)", [product.id, future]);
  return { future, past, products };
}
function issuedGuest(reply: Reply) {
  const setCookie = reply.cookie;
  if (!setCookie?.startsWith(`${guestName}=`)) throw new Error("Guest initialization must issue a guest cookie");
  const match = setCookie.match(new RegExp(`^${guestName}=([^;]+)`));
  if (!match) throw new Error("Guest cookie missing token");
  return cookie(guestName, match[1]);
}
async function initializeGuest() { return issuedGuest(await request("POST", 200, { body: command("initialize") })); }
async function setItem(cartCookie: string, version: number, slug: string, quantity: number, status: number | number[] = 200, source?: "guest" | "account") {
  return request("POST", status, { cookie: cartCookie, body: command("set-item", { expectedVersion: version, slug, quantity, ...(source ? { source } : {}) }) });
}
async function setSlot(cartCookie: string, version: number, businessDate: string, slotKey: string, status = 200) {
  return request("POST", status, { cookie: cartCookie, body: command("set-slot", { expectedVersion: version, businessDate, slotKey }) });
}

async function main() {
  stage = "admin-connect";
  await admin.connect();
  assert.match(name, /^bep_cart_test_[a-f0-9]{32}$/);
  stage = "create-database";
  await admin.query(`CREATE DATABASE "${name}"`); created = true;
  stage = "migrate";
  await runner({ databaseUrl: url.toString(), dir: path.resolve("migrations"), direction: "up", migrationsTable: "pgmigrations", checkOrder: false,
    logger: { info() {}, warn() {}, error() {} } });
  stage = "fixture-schema";
  await fixtureSchema();
  stage = "fixtures";
  const { future, past, products } = await fixtures();
  stage = "accounts";
  const accountA = await fixtureAccount(), accountB = await fixtureAccount();
  stage = "listen";
  server.listen(serveUi ? servePort : 0, "127.0.0.1"); await once(server, "listening");
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  stage = "http-checks";
  const empty = await request("GET", 200);
  assert.equal(empty.data.id, null); assert.equal((await pool.query("SELECT count(*)::int AS count FROM carts")).rows[0].count, 0, "GET must not create a cart");
  await request("POST", 400, { body: { ...command("initialize"), extra: true } });
  await request("POST", 403, { body: command("initialize"), from: "https://attacker.invalid" });
  const guest = await initializeGuest();
  assert(!guest.includes("Max-Age"), "Initial guest cookie must be a session cookie");
  const initialized = await request("GET", 200, { cookie: guest });
  assert.equal(initialized.data.owner, "guest"); assert.equal(initialized.data.version, 1);
  assert.equal((await pool.query("SELECT expires_at FROM carts WHERE guest_token_hash=$1", [tokenHash(guest.slice(guestName.length + 1))])).rows[0].expires_at, null, "Guest cart must not have a persistent TTL");
  const first = await setItem(guest, 1, products[0].slug, 2);
  assert.equal(first.data.items[0]?.quantity, 2); assert.equal(first.data.version, 2);
  const stale = await setItem(guest, 1, products[0].slug, 3, 409);
  assert.equal(stale.code, "CART_VERSION_CONFLICT");
  await request("POST", 400, { cookie: guest, body: { ...command("set-item", { expectedVersion: 2, slug: products[0].slug, quantity: 1 }), forged: true } });
  await request("GET", 401, { cookie: `${guest}; ${guest}` });
  await request("GET", 401, { cookie: `${cookie(sessionName, "invalid")}; ${guest}` });

  const perItem = await initializeGuest();
  const perItemFailure = await setItem(perItem, 1, products[0].slug, 21, 409);
  assert.equal(perItemFailure.code, "CART_QUANTITY_LIMIT");
  const total = await initializeGuest();
  const totalOne = await setItem(total, 1, products[0].slug, 20);
  const totalTwo = await setItem(total, totalOne.data.version, products[1].slug, 20);
  const totalFailure = await setItem(total, totalTwo.data.version, products[2].slug, 11, 409);
  assert.equal(totalFailure.code, "CART_QUANTITY_LIMIT");
  const otherGuest = await initializeGuest();
  await setItem(otherGuest, 1, products[1].slug, 1);
  assert.equal((await request("GET", 200, { cookie: guest })).data.items.map((item) => item.slug).join(), products[0].slug, "Guest carts must be isolated");
  assert.equal((await request("GET", 200, { cookie: otherGuest })).data.items[0]?.slug, products[1].slug);

  const cutoffGuest = await initializeGuest();
  const cutoff = await setSlot(cutoffGuest, 1, past, "cart-cutoff", 409);
  assert.equal(cutoff.code, "SLOT_UNAVAILABLE");
  const slotted = await setSlot(cutoffGuest, 1, future, "cart-future");
  assert.equal(slotted.data.businessDate, future); assert.equal(slotted.data.slotKey, "cart-future");
  const persisted = await request("GET", 200, { cookie: cutoffGuest });
  assert.equal(persisted.data.businessDate, future); assert.equal(persisted.data.slotKey, "cart-future");

  const accountInit = await request("POST", 200, { cookie: accountA.cookie, body: command("initialize") });
  assert.equal(accountInit.cookie, null, "Account initialization must not issue a guest cookie");
  assert.equal(accountInit.data.owner, "account");
  const mergeGuest = await initializeGuest();
  const guestItem = await setItem(mergeGuest, 1, products[0].slug, 2);
  const accountItem = await setItem(accountA.cookie, accountInit.data.version, products[0].slug, 3);
  const accountWithGuest = await request("GET", 200, { cookie: `${accountA.cookie}; ${mergeGuest}` });
  assert.equal(accountWithGuest.data.guestCart?.version, guestItem.data.version);
  const guestEdited = await setItem(`${accountA.cookie}; ${mergeGuest}`, guestItem.data.version, products[0].slug, 3, 200, "guest");
  assert.equal(guestEdited.data.owner, "account"); assert.equal(guestEdited.data.items[0]?.quantity, 3);
  assert.equal(guestEdited.data.guestCart?.items[0]?.quantity, 3); assert.equal(guestEdited.data.guestCart?.version, guestItem.data.version + 1);
  const missingGuest = await setItem(accountA.cookie, guestEdited.data.guestCart!.version, products[0].slug, 1, 409, "guest");
  assert.equal(missingGuest.code, "CART_VERSION_CONFLICT");
  const invalidGuestSource = await setItem(`${cookie(sessionName, "invalid")}; ${mergeGuest}`, guestEdited.data.guestCart!.version, products[0].slug, 1, 401, "guest");
  assert.equal(invalidGuestSource.code, "INVALID_CREDENTIAL");
  const ownerGuard = await setItem(mergeGuest, guestEdited.data.guestCart!.version, products[0].slug, 1, 401, "account");
  assert.equal(ownerGuard.code, "UNAUTHENTICATED");
  const merged = await request("POST", 200, { cookie: `${accountA.cookie}; ${mergeGuest}`, body: command("merge", { expectedVersion: accountItem.data.version, guestVersion: guestEdited.data.guestCart!.version }) });
  assert.equal(merged.data.items[0]?.quantity, 6); assert.equal(merged.cookie, `${guestName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  assert.equal((await pool.query("SELECT status FROM carts WHERE guest_token_hash=$1", [tokenHash(mergeGuest.slice(guestName.length + 1))])).rows[0].status, "MERGED");
  const singleUse = await request("POST", 409, { cookie: `${accountA.cookie}; ${mergeGuest}`, body: command("merge", { expectedVersion: merged.data.version, guestVersion: guestEdited.data.guestCart!.version }) });
  assert.equal(singleUse.code, "CART_VERSION_CONFLICT");

  const conflictGuest = await initializeGuest();
  const conflictGuestSlot = await setSlot(conflictGuest, 1, future, "cart-future");
  const accountBInit = await request("POST", 200, { cookie: accountB.cookie, body: command("initialize") });
  const accountBSlot = await setSlot(accountB.cookie, accountBInit.data.version, future, "cart-cutoff");
  const slotConflict = await request("POST", 409, { cookie: `${accountB.cookie}; ${conflictGuest}`, body: command("merge", { expectedVersion: accountBSlot.data.version, guestVersion: conflictGuestSlot.data.version }) });
  assert.equal(slotConflict.code, "CART_SLOT_CONFLICT");
  assert.equal((await request("GET", 200, { cookie: accountB.cookie })).data.slotKey, "cart-cutoff");
  assert.equal((await request("GET", 200, { cookie: conflictGuest })).data.slotKey, "cart-future", "Slot conflict must not lose either cart");

  const quotaAccount = await fixtureAccount();
  const quotaInit = await request("POST", 200, { cookie: quotaAccount.cookie, body: command("initialize") });
  const quotaAccountItem = await setItem(quotaAccount.cookie, quotaInit.data.version, products[2].slug, 20);
  const quotaGuest = await initializeGuest();
  const quotaGuestItem = await setItem(quotaGuest, 1, products[2].slug, 20);
  const quotaFailure = await request("POST", 409, { cookie: `${quotaAccount.cookie}; ${quotaGuest}`, body: command("merge", { expectedVersion: quotaAccountItem.data.version, guestVersion: quotaGuestItem.data.version }) });
  assert.equal(quotaFailure.code, "CART_QUANTITY_LIMIT");
  assert.equal((await request("GET", 200, { cookie: quotaAccount.cookie })).data.items[0]?.quantity, 20);
  assert.equal((await request("GET", 200, { cookie: quotaGuest })).data.items[0]?.quantity, 20, "Quota failure must roll back merge");

  const race = await initializeGuest();
  const raceResults = await Promise.all([
    setItem(race, 1, products[0].slug, 1, [200, 409]), setItem(race, 1, products[1].slug, 1, [200, 409])
  ]);
  assert.deepEqual(raceResults.map((result) => result.code ?? "OK").sort(), ["CART_VERSION_CONFLICT", "OK"]);
  const sideEffects = await pool.query("SELECT (SELECT count(*)::int FROM inventory_reservations) AS reservations,(SELECT count(*)::int FROM orders) AS orders,(SELECT count(*)::int FROM order_access_tokens) AS claims,(SELECT count(*)::int FROM idempotency_requests) AS idempotency");
  assert.equal(sideEffects.rows[0].reservations, 0); assert.equal(sideEffects.rows[0].orders, 0);
  assert.equal(sideEffects.rows[0].claims, 0); assert.equal(sideEffects.rows[0].idempotency, 0, "Cart writes must not create checkout claims");
  if (!serveUi) console.log(`PASS: ${checks} isolated cart HTTP checks`);
  else {
    console.log(origin);
    stage = "serve-ui";
    await new Promise<void>((resolve) => {
      const stop = () => { process.off("SIGINT", stop); process.off("SIGTERM", stop); resolve(); };
      process.once("SIGINT", stop); process.once("SIGTERM", stop);
    });
  }
}

void main().catch((error: unknown) => {
  const candidate = error instanceof pg.DatabaseError ? error.code : error && typeof error === "object" && "code" in error ? error.code : null;
  const code = typeof candidate === "string" && /^[A-Z0-9_]{1,64}$/.test(candidate) ? candidate : error instanceof assert.AssertionError ? "ASSERTION" : "UNKNOWN";
  console.error(`FAIL: stage=${stage} code=${code}`);
  process.exitCode = 1;
}).finally(async () => {
  server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
  if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.end();
});
