import "server-only";
import { query } from "@/db/client";
import type { AdminRole } from "@/lib/admin/permissions";

export type AdminUserRecord = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: AdminRole;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type SafeAdminUser = Omit<AdminUserRecord, "password_hash">;

export async function findAdminUserByEmail(email: string) {
  const result = await query<AdminUserRecord>(
    `
      SELECT
        id,
        email,
        password_hash,
        name,
        role,
        is_active,
        last_login_at,
        created_at,
        updated_at
      FROM admin_users
      WHERE email = $1
      LIMIT 1
    `,
    [email.toLowerCase()]
  );

  return result.rows[0] ?? null;
}

export async function findAdminUserById(id: string) {
  const result = await query<SafeAdminUser>(
    `
      SELECT
        id,
        email,
        name,
        role,
        is_active,
        last_login_at,
        created_at,
        updated_at
      FROM admin_users
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function createAdminUser(input: {
  email: string;
  passwordHash: string;
  name: string;
  role: AdminRole;
}) {
  const result = await query<SafeAdminUser>(
    `
      INSERT INTO admin_users (email, password_hash, name, role)
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        email,
        name,
        role,
        is_active,
        last_login_at,
        created_at,
        updated_at
    `,
    [input.email.toLowerCase(), input.passwordHash, input.name, input.role]
  );

  return result.rows[0];
}

export async function updateAdminLastLogin(id: string) {
  await query(
    `
      UPDATE admin_users
      SET last_login_at = now()
      WHERE id = $1
    `,
    [id]
  );
}

export async function countRecentFailedLoginAttempts(email: string) {
  const result = await query<{ count: string }>(
    `
      SELECT count(*)::text AS count
      FROM admin_login_attempts
      WHERE email = $1
        AND success = false
        AND attempted_at > now() - interval '15 minutes'
    `,
    [email.toLowerCase()]
  );

  return Number(result.rows[0]?.count ?? 0);
}

export async function recordAdminLoginAttempt(input: {
  email: string;
  success: boolean;
  failureReason?: string;
}) {
  await query(
    `
      INSERT INTO admin_login_attempts (email, success, failure_reason)
      VALUES ($1, $2, $3)
    `,
    [input.email.toLowerCase(), input.success, input.failureReason ?? null]
  );
}
