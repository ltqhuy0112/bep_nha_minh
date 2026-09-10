import type { QueryResultRow } from "pg";
import { query } from "@bep-nha-minh/api/db/client";

type WaitlistListRow = QueryResultRow & {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  district: string;
  preferred_meal: string | null;
  source: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  total_count: string;
};

export type WaitlistListInput = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function listAdminWaitlist(input: WaitlistListInput) {
  const values: unknown[] = [];
  const where: string[] = [];

  function addValue(value: unknown) {
    values.push(value);
    return `$${values.length}`;
  }

  if (input.search) {
    const searchParam = addValue(`%${input.search}%`);
    where.push(`(
      name ILIKE ${searchParam}
      OR phone ILIKE ${searchParam}
      OR email ILIKE ${searchParam}
      OR district ILIKE ${searchParam}
      OR preferred_meal ILIKE ${searchParam}
    )`);
  }

  if (input.status) {
    where.push(`status = ${addValue(input.status)}`);
  }

  if (input.dateFrom) {
    where.push(`created_at >= ${addValue(input.dateFrom)}::date`);
  }

  if (input.dateTo) {
    where.push(`created_at < (${addValue(input.dateTo)}::date + interval '1 day')`);
  }

  const offset = (input.page - 1) * input.pageSize;
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const result = await query<WaitlistListRow>(
    `
      SELECT
        id,
        name,
        phone,
        email,
        district,
        preferred_meal,
        source,
        status,
        created_at,
        updated_at,
        count(*) OVER()::text AS total_count
      FROM waitlist
      ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT ${addValue(input.pageSize)}
      OFFSET ${addValue(offset)}
    `,
    values
  );

  const totalItems = Number(result.rows[0]?.total_count ?? 0);

  return {
    items: result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      district: row.district,
      preferredMeal: row.preferred_meal,
      source: row.source,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / input.pageSize)
    }
  };
}

export type AdminWaitlistList = Awaited<ReturnType<typeof listAdminWaitlist>>;
