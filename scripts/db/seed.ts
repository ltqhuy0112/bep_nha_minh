import "dotenv/config";
import pg from "pg";
import {
  seedCustomers as adminSeedCustomers,
  seedMenuItems as adminSeedMenuItems,
  seedOrders as adminSeedOrders,
  seededAdminId,
  seededManagerId,
  type SeedOrderStatus
} from "@bep-nha-minh/api/data/admin-seed-data";
import { siteContent } from "@bep-nha-minh/api/data/site-content";
import { hashAdminPassword } from "@bep-nha-minh/api/lib/admin/password";

const { Pool } = pg;

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh";

const pool = new Pool({
  connectionString: databaseUrl
});

const seedRecords = [
  ["hero", siteContent.hero],
  ["brand_values", siteContent.values],
  ["story", siteContent.story],
  ["dishes", siteContent.dishes],
  ["workflow", siteContent.workflow],
  ["social_links", siteContent.social]
] as const;

function orderId(index: number) {
  return `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function yyyyMmDd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function statusSteps(status: SeedOrderStatus) {
  const common = ["PENDING"] as SeedOrderStatus[];
  if (status === "PENDING") return common;
  if (status === "APPROVED") return [...common, "APPROVED"];
  if (status === "PREPARING") return [...common, "APPROVED", "PREPARING"];
  if (status === "READY") return [...common, "APPROVED", "PREPARING", "READY"];
  if (status === "DELIVERING") return [...common, "APPROVED", "PREPARING", "READY", "DELIVERING"];
  if (status === "COMPLETED") return [...common, "APPROVED", "PREPARING", "READY", "DELIVERING", "COMPLETED"];
  if (status === "REJECTED") return [...common, "REJECTED"];
  return [...common, "APPROVED", "CANCELLED"];
}

async function seedSiteContent(client: pg.PoolClient) {
  for (const [sectionKey, content] of seedRecords) {
    await client.query(
      `
        INSERT INTO site_content (section_key, content_json, is_published)
        VALUES ($1, $2, true)
        ON CONFLICT (section_key)
        DO UPDATE SET
          content_json = EXCLUDED.content_json,
          is_published = EXCLUDED.is_published
      `,
      [sectionKey, JSON.stringify(content)]
    );
  }
}

async function seedAdmins(client: pg.PoolClient) {
  const password =
    process.env.SEED_ADMIN_PASSWORD ?? "Admin12345!@#";
  const passwordHash = await hashAdminPassword(password);

  const admins = [
    [seededAdminId, "admin@bepnhaminh.local", "Bếp Admin", "SUPER_ADMIN"],
    [seededManagerId, "orders@bepnhaminh.local", "Quản lý đơn hàng", "ORDER_MANAGER"]
  ] as const;

  for (const admin of admins) {
    await client.query(
      `
        INSERT INTO admin_users (
          id,
          email,
          password_hash,
          name,
          role,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, true, now() - interval '14 days', now())
        ON CONFLICT (email)
        DO UPDATE SET
          id = EXCLUDED.id,
          password_hash = EXCLUDED.password_hash,
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          is_active = true,
          updated_at = now()
      `,
      [admin[0], admin[1], passwordHash, admin[2], admin[3]]
    );
  }
}

async function seedCustomers(client: pg.PoolClient) {
  for (const customer of adminSeedCustomers) {
    await client.query(
      `
        INSERT INTO customers (
          id,
          full_name,
          phone,
          email,
          address_line,
          ward,
          district,
          city,
          notes,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() - interval '18 days', now())
        ON CONFLICT (id)
        DO UPDATE SET
          full_name = EXCLUDED.full_name,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          address_line = EXCLUDED.address_line,
          ward = EXCLUDED.ward,
          district = EXCLUDED.district,
          city = EXCLUDED.city,
          notes = EXCLUDED.notes,
          updated_at = now()
      `,
      [...customer]
    );
  }
}

async function seedOrders(client: pg.PoolClient) {
  const seedOrderIds = adminSeedOrders.map((_, index) => orderId(index));

  await client.query("DELETE FROM audit_logs WHERE metadata->>'seedSource' = 'bep-nha-minh-demo';");
  await client.query("DELETE FROM order_status_history WHERE order_id = ANY($1::uuid[]);", [seedOrderIds]);
  await client.query("DELETE FROM order_items WHERE order_id = ANY($1::uuid[]);", [seedOrderIds]);

  for (const [index, order] of adminSeedOrders.entries()) {
    const id = orderId(index);
    const customer = adminSeedCustomers[order.customerIndex];
    const createdAt = hoursAgo(order.ageHours);
    const deliveryDate = addHours(createdAt, 18);
    const deliveryFee = order.deliveryFee ?? (order.fulfillmentType === "DELIVERY" ? 15000 : 0);
    const discount = order.discount ?? 0;
    const orderItems = order.items.map(([menuIndex, quantity]) => {
      const [name, unitPrice] = adminSeedMenuItems[menuIndex];
      return {
        name,
        quantity,
        unitPrice,
        lineTotal: quantity * unitPrice,
        snapshot: {
          name,
          unitPrice,
          category: menuIndex >= 4 && menuIndex <= 5 ? "combo" : "daily-menu",
          seedSource: "bep-nha-minh-demo"
        }
      };
    });
    const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const total = subtotal + deliveryFee - discount;
    const approvedAt = ["APPROVED", "PREPARING", "READY", "DELIVERING", "COMPLETED", "CANCELLED"].includes(order.status)
      ? addHours(createdAt, 1)
      : null;
    const rejectedAt = order.status === "REJECTED" ? addHours(createdAt, 1) : null;
    const cancelledAt = order.status === "CANCELLED" ? addHours(createdAt, 2) : null;

    await client.query(
      `
        INSERT INTO orders (
          id,
          order_code,
          customer_id,
          status,
          fulfillment_type,
          delivery_date,
          delivery_time_slot,
          subtotal_amount,
          delivery_fee,
          discount_amount,
          total_amount,
          currency,
          customer_note,
          internal_note,
          approved_at,
          approved_by,
          rejected_at,
          rejected_by,
          rejection_reason,
          cancelled_at,
          cancelled_by,
          cancellation_reason,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'VND',
          $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, now()
        )
        ON CONFLICT (order_code)
        DO UPDATE SET
          id = EXCLUDED.id,
          customer_id = EXCLUDED.customer_id,
          status = EXCLUDED.status,
          fulfillment_type = EXCLUDED.fulfillment_type,
          delivery_date = EXCLUDED.delivery_date,
          delivery_time_slot = EXCLUDED.delivery_time_slot,
          subtotal_amount = EXCLUDED.subtotal_amount,
          delivery_fee = EXCLUDED.delivery_fee,
          discount_amount = EXCLUDED.discount_amount,
          total_amount = EXCLUDED.total_amount,
          customer_note = EXCLUDED.customer_note,
          internal_note = EXCLUDED.internal_note,
          approved_at = EXCLUDED.approved_at,
          approved_by = EXCLUDED.approved_by,
          rejected_at = EXCLUDED.rejected_at,
          rejected_by = EXCLUDED.rejected_by,
          rejection_reason = EXCLUDED.rejection_reason,
          cancelled_at = EXCLUDED.cancelled_at,
          cancelled_by = EXCLUDED.cancelled_by,
          cancellation_reason = EXCLUDED.cancellation_reason,
          created_at = EXCLUDED.created_at,
          updated_at = now()
      `,
      [
        id,
        order.code,
        customer[0],
        order.status,
        order.fulfillmentType,
        yyyyMmDd(deliveryDate),
        order.fulfillmentType === "DELIVERY" ? "11:00 - 13:00" : "17:00 - 18:30",
        subtotal,
        deliveryFee,
        discount,
        total,
        order.note ?? null,
        order.internalNote ?? null,
        approvedAt,
        approvedAt ? seededManagerId : null,
        rejectedAt,
        rejectedAt ? seededManagerId : null,
        order.status === "REJECTED" ? order.reason : null,
        cancelledAt,
        cancelledAt ? seededManagerId : null,
        order.status === "CANCELLED" ? order.reason : null,
        createdAt
      ]
    );

    for (const [itemIndex, item] of orderItems.entries()) {
      await client.query(
        `
          INSERT INTO order_items (
            id,
            order_id,
            item_name,
            item_snapshot,
            quantity,
            unit_price,
            line_total,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          `40000000-0000-4000-8000-${String(index * 10 + itemIndex + 1).padStart(12, "0")}`,
          id,
          item.name,
          JSON.stringify(item.snapshot),
          item.quantity,
          item.unitPrice,
          item.lineTotal,
          createdAt
        ]
      );
    }

    const steps = statusSteps(order.status);
    for (const [stepIndex, toStatus] of steps.entries()) {
      const fromStatus = stepIndex === 0 ? null : steps[stepIndex - 1];
      const reason =
        toStatus === "REJECTED" || toStatus === "CANCELLED"
          ? order.reason ?? "Cập nhật theo yêu cầu vận hành"
          : stepIndex === 0
            ? "Khách gửi đơn qua kênh đặt trước"
            : null;
      const changedAt = addHours(createdAt, stepIndex);

      await client.query(
        `
          INSERT INTO order_status_history (
            id,
            order_id,
            from_status,
            to_status,
            reason,
            changed_by,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          `50000000-0000-4000-8000-${String(index * 10 + stepIndex + 1).padStart(12, "0")}`,
          id,
          fromStatus,
          toStatus,
          reason,
          stepIndex === 0 ? null : seededManagerId,
          changedAt
        ]
      );

      if (stepIndex > 0) {
        await client.query(
          `
            INSERT INTO audit_logs (
              id,
              actor_admin_id,
              action,
              entity_type,
              entity_id,
              metadata,
              ip_address,
              user_agent,
              created_at
            )
            VALUES ($1, $2, $3, 'order', $4, $5, '127.0.0.1', 'seed-script', $6)
          `,
          [
            `60000000-0000-4000-8000-${String(index * 10 + stepIndex + 1).padStart(12, "0")}`,
            seededManagerId,
            toStatus === "APPROVED"
              ? "orders.approve"
              : toStatus === "REJECTED"
                ? "orders.reject"
                : toStatus === "CANCELLED"
                  ? "orders.cancel"
                  : "orders.update_status",
            id,
            JSON.stringify({
              seedSource: "bep-nha-minh-demo",
              orderCode: order.code,
              fromStatus,
              toStatus,
              reason
            }),
            changedAt
          ]
        );
      }
    }
  }
}

async function seed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await seedSiteContent(client);
    await seedAdmins(client);
    await seedCustomers(client);
    await seedOrders(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

seed()
  .then(async () => {
    console.log(
      `Seeded ${seedRecords.length} site_content records, 2 admin users, ${adminSeedCustomers.length} customers, ${adminSeedOrders.length} orders.`
    );
    await pool.end();
  })
  .catch(async (error: unknown) => {
    console.error("Seed failed.", error);
    await pool.end();
    process.exit(1);
  });
