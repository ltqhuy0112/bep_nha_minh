import type { QueryResultRow } from "pg";
import { query } from "@bep-nha-minh/api/db/client";

type CustomerListRow = QueryResultRow & {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  district: string | null;
  city: string | null;
  created_at: Date;
  total_orders: string;
  completed_value: string;
  latest_order_at: Date | null;
  total_count: string;
};

type CustomerDetailRow = QueryResultRow & {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address_line: string | null;
  ward: string | null;
  district: string | null;
  city: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  total_order_count: string;
  total_completed_order_value: string;
  first_order_date: Date | null;
  latest_order_date: Date | null;
};

type CustomerOrderRow = QueryResultRow & {
  id: string;
  order_code: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: Date;
};

export type CustomerListInput = {
  page: number;
  pageSize: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function listAdminCustomers(input: CustomerListInput) {
  const values: unknown[] = [];
  const where: string[] = [];

  function addValue(value: unknown) {
    values.push(value);
    return `$${values.length}`;
  }

  if (input.search) {
    const searchParam = addValue(`%${input.search}%`);
    where.push(`(
      c.full_name ILIKE ${searchParam}
      OR c.phone ILIKE ${searchParam}
      OR c.email ILIKE ${searchParam}
    )`);
  }

  if (input.dateFrom) {
    where.push(`c.created_at >= ${addValue(input.dateFrom)}::date`);
  }

  if (input.dateTo) {
    where.push(`c.created_at < (${addValue(input.dateTo)}::date + interval '1 day')`);
  }

  const offset = (input.page - 1) * input.pageSize;
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const result = await query<CustomerListRow>(
    `
      SELECT
        c.id,
        c.full_name,
        c.phone,
        c.email,
        c.district,
        c.city,
        c.created_at,
        count(o.id)::text AS total_orders,
        COALESCE(sum(o.total_amount) FILTER (WHERE o.status = 'COMPLETED'), 0)::text AS completed_value,
        max(o.created_at) AS latest_order_at,
        count(*) OVER()::text AS total_count
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      ${whereSql}
      GROUP BY c.id
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT ${addValue(input.pageSize)}
      OFFSET ${addValue(offset)}
    `,
    values
  );

  const totalItems = Number(result.rows[0]?.total_count ?? 0);

  return {
    items: result.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      phone: row.phone,
      email: row.email,
      district: row.district,
      city: row.city,
      createdAt: row.created_at,
      totalOrders: Number(row.total_orders),
      completedValue: Number(row.completed_value),
      latestOrderAt: row.latest_order_at
    })),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / input.pageSize)
    }
  };
}

export type AdminCustomerList = Awaited<ReturnType<typeof listAdminCustomers>>;

export async function getAdminCustomerDetail(customerId: string) {
  const detailResult = await query<CustomerDetailRow>(
    `
      SELECT
        c.id,
        c.full_name,
        c.phone,
        c.email,
        c.address_line,
        c.ward,
        c.district,
        c.city,
        c.notes,
        c.created_at,
        c.updated_at,
        count(o.id)::text AS total_order_count,
        COALESCE(sum(o.total_amount) FILTER (WHERE o.status = 'COMPLETED'), 0)::text AS total_completed_order_value,
        min(o.created_at) AS first_order_date,
        max(o.created_at) AS latest_order_date
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
      LIMIT 1
    `,
    [customerId]
  );

  const customer = detailResult.rows[0];
  if (!customer) {
    return null;
  }

  const ordersResult = await query<CustomerOrderRow>(
    `
      SELECT
        id,
        order_code,
        status,
        total_amount,
        currency,
        created_at
      FROM orders
      WHERE customer_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 10
    `,
    [customerId]
  );

  return {
    id: customer.id,
    fullName: customer.full_name,
    phone: customer.phone,
    email: customer.email,
    addressLine: customer.address_line,
    ward: customer.ward,
    district: customer.district,
    city: customer.city,
    notes: customer.notes,
    createdAt: customer.created_at,
    updatedAt: customer.updated_at,
    stats: {
      totalOrderCount: Number(customer.total_order_count),
      totalCompletedOrderValue: Number(customer.total_completed_order_value),
      firstOrderDate: customer.first_order_date,
      latestOrderDate: customer.latest_order_date
    },
    latestOrders: ordersResult.rows.map((row) => ({
      id: row.id,
      orderCode: row.order_code,
      status: row.status,
      totalAmount: row.total_amount,
      currency: row.currency,
      createdAt: row.created_at
    }))
  };
}

export type AdminCustomerDetail = NonNullable<
  Awaited<ReturnType<typeof getAdminCustomerDetail>>
>;
