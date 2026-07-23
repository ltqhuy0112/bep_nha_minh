import "server-only";
import { query } from "@/db/client";
import type { WaitlistInput } from "@/lib/validation";

export type WaitlistRecord = {
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
};

export async function findExistingWaitlistLead(input: WaitlistInput) {
  const values: string[] = [];
  const clauses: string[] = [];

  if (input.phone) {
    values.push(input.phone);
    clauses.push(`phone = $${values.length}`);
  }

  if (input.email) {
    values.push(input.email);
    clauses.push(`email = $${values.length}`);
  }

  if (clauses.length === 0) {
    return null;
  }

  const result = await query<Pick<WaitlistRecord, "id">>(
    `SELECT id FROM waitlist WHERE ${clauses.join(" OR ")} LIMIT 1`,
    values
  );

  return result.rows[0] ?? null;
}

export async function createWaitlistLead(input: WaitlistInput) {
  const result = await query<WaitlistRecord>(
    `
      INSERT INTO waitlist (
        name,
        phone,
        email,
        district,
        preferred_meal,
        source
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        name,
        phone,
        email,
        district,
        preferred_meal,
        source,
        status,
        created_at,
        updated_at
    `,
    [
      input.name,
      input.phone || null,
      input.email || null,
      input.district,
      input.preferredMeal || null,
      input.source || "website"
    ]
  );

  return result.rows[0];
}
