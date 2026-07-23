import "server-only";
import type { QueryResultRow } from "pg";
import { query } from "@/db/client";

type AuditLogListRow = QueryResultRow & {
  id: string;
  actor_admin_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  total_count: string;
};

export type AuditLogListInput = {
  page: number;
  pageSize: number;
  search?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function listAdminAuditLogs(input: AuditLogListInput) {
  const values: unknown[] = [];
  const where: string[] = [];

  function addValue(value: unknown) {
    values.push(value);
    return `$${values.length}`;
  }

  if (input.search) {
    const searchParam = addValue(`%${input.search}%`);
    where.push(`(
      al.action ILIKE ${searchParam}
      OR al.entity_type ILIKE ${searchParam}
      OR al.metadata::text ILIKE ${searchParam}
      OR au.name ILIKE ${searchParam}
      OR au.email ILIKE ${searchParam}
    )`);
  }

  if (input.action) {
    where.push(`al.action = ${addValue(input.action)}`);
  }

  if (input.entityType) {
    where.push(`al.entity_type = ${addValue(input.entityType)}`);
  }

  if (input.dateFrom) {
    where.push(`al.created_at >= ${addValue(input.dateFrom)}::date`);
  }

  if (input.dateTo) {
    where.push(`al.created_at < (${addValue(input.dateTo)}::date + interval '1 day')`);
  }

  const offset = (input.page - 1) * input.pageSize;
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const result = await query<AuditLogListRow>(
    `
      SELECT
        al.id,
        al.actor_admin_id,
        au.name AS actor_name,
        au.email AS actor_email,
        al.action,
        al.entity_type,
        al.entity_id,
        al.metadata,
        al.ip_address,
        al.user_agent,
        al.created_at,
        count(*) OVER()::text AS total_count
      FROM audit_logs al
      LEFT JOIN admin_users au ON au.id = al.actor_admin_id
      ${whereSql}
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ${addValue(input.pageSize)}
      OFFSET ${addValue(offset)}
    `,
    values
  );

  const totalItems = Number(result.rows[0]?.total_count ?? 0);

  return {
    items: result.rows.map((row) => ({
      id: row.id,
      actorAdminId: row.actor_admin_id,
      actorName: row.actor_name,
      actorEmail: row.actor_email,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: row.metadata,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at
    })),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / input.pageSize)
    }
  };
}

export type AdminAuditLogList = Awaited<ReturnType<typeof listAdminAuditLogs>>;
