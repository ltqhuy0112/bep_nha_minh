import "dotenv/config";
import assert from "node:assert/strict";
import pg from "pg";
import {
  seedCustomers,
  seedOrders
} from "@bep-nha-minh/api/data/admin-seed-data";
import { verifyAdminPassword } from "@bep-nha-minh/api/lib/admin/password";

const { Pool } = pg;

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh";
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const seedPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345!@#";

const pool = new Pool({ connectionString: databaseUrl });
const expectedSeedOrderItemCount = seedOrders.reduce(
  (total, order) => total + order.items.length,
  0
);

async function scalar(sql: string, values: unknown[] = []) {
  const result = await pool.query<{ value: string }>(sql, values);
  return Number(result.rows[0]?.value ?? 0);
}

async function verifySeedData() {
  assert.equal(
    await scalar("select count(*)::text as value from admin_users where email in ('admin@bepnhaminh.local', 'orders@bepnhaminh.local')"),
    2,
    "expected demo admin users"
  );
  assert.ok(
    (await scalar("select count(*)::text as value from customers")) >=
      seedCustomers.length,
    "expected seeded customers"
  );
  assert.ok(
    (await scalar("select count(*)::text as value from orders")) >=
      seedOrders.length,
    "expected seeded orders"
  );
  assert.ok(
    (await scalar("select count(*)::text as value from order_items")) >=
      expectedSeedOrderItemCount,
    "expected seeded order items"
  );
  assert.ok(
    (await scalar("select count(*)::text as value from order_status_history")) >= 100,
    "expected status history"
  );
  assert.ok(
    (await scalar("select count(*)::text as value from audit_logs where metadata->>'seedSource' = 'bep-nha-minh-demo'")) >= 70,
    "expected seed audit logs"
  );

  const statusResult = await pool.query<{ status: string; count: string }>(
    "select status, count(*)::text as count from orders group by status"
  );
  const statuses = new Set(statusResult.rows.map((row) => row.status));
  for (const status of [
    "PENDING",
    "APPROVED",
    "PREPARING",
    "READY",
    "DELIVERING",
    "COMPLETED",
    "REJECTED",
    "CANCELLED"
  ]) {
    assert.ok(statuses.has(status), `expected status ${status}`);
  }

  const adminResult = await pool.query<{ password_hash: string }>(
    "select password_hash from admin_users where email = 'admin@bepnhaminh.local' limit 1"
  );
  assert.equal(
    await verifyAdminPassword(seedPassword, adminResult.rows[0].password_hash),
    true,
    "expected seeded admin password to verify"
  );
}

async function verifyHttp() {
  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200, "health endpoint should return 200");

  const admin = await fetch(`${baseUrl}/admin`, { redirect: "manual" });
  assert.equal(admin.status, 307, "admin page should redirect unauthenticated users");
  assert.equal(admin.headers.get("location"), "/admin/login");

  const orderApi = await fetch(`${baseUrl}/api/admin/orders`);
  assert.equal(orderApi.status, 401, "orders API should reject unauthenticated requests");

  const analyticsApi = await fetch(`${baseUrl}/api/admin/analytics/orders?range=7d`);
  assert.equal(
    analyticsApi.status,
    401,
    "analytics API should reject unauthenticated requests"
  );
}

async function verifyAnalyticsSql() {
  const result = await pool.query<{ bucket_count: string }>(
    `
      WITH bounds AS (
        SELECT
          date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') - interval '6 days' AS local_start,
          date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') + interval '1 day' AS local_end
      ),
      buckets AS (
        SELECT generate_series(
          (SELECT local_start FROM bounds),
          (SELECT local_end FROM bounds) - interval '1 day',
          interval '1 day'
        ) AS bucket
      )
      SELECT count(*)::text AS bucket_count FROM buckets
    `
  );
  assert.equal(Number(result.rows[0].bucket_count), 7, "expected 7 dashboard buckets");
}

async function main() {
  await verifySeedData();
  await verifyAnalyticsSql();
  await verifyHttp();
  console.log("Runtime verification passed.");
}

main()
  .catch((error: unknown) => {
    console.error("Runtime verification failed.", error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
