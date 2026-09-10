import { createHmac } from "node:crypto";
import type { Pool } from "pg";
import { AuthError } from "./security";

export type AuthRatePolicy = { key: string; limit: number; windowSeconds: number };
export type AuthRateDecision = { allowed: boolean; retryAfterSeconds: number };

export class SharedAuthLimiter {
  private readonly key: Buffer;

  constructor(private readonly pool: Pool, private readonly policy: AuthRatePolicy) {
    this.key = Buffer.from(policy.key, "base64");
    if (!/^[A-Za-z0-9+/]{43}=$/.test(policy.key) || this.key.length !== 32 ||
        !Number.isInteger(policy.limit) || policy.limit < 1 || policy.limit > 10_000 ||
        !Number.isInteger(policy.windowSeconds) || policy.windowSeconds < 1 || policy.windowSeconds > 3600) {
      throw new Error("Invalid shared customer auth rate policy.");
    }
  }

  async take(action: string, identity: string): Promise<AuthRateDecision> {
    if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(action)) throw new Error("Invalid auth rate scope.");
    const hash = createHmac("sha256", this.key).update(JSON.stringify([action, identity])).digest("hex");
    try {
      // Database time and a single UPSERT serialize replicas on the same fixed-window key.
      const result = await this.pool.query<{ allowed: boolean; retry_after: number }>(`
        WITH bucket AS (
          SELECT date_bin(make_interval(secs => $3::int), statement_timestamp(),
            '1970-01-01 00:00:00+00'::timestamptz) AS starts
        )
        INSERT INTO customer_auth_rate_limits AS limits
          (action, key_hash, window_started_at, window_expires_at, attempt_count)
        SELECT $1, $2, starts, starts + make_interval(secs => $3::int), 1 FROM bucket
        ON CONFLICT (action, key_hash, window_started_at) DO UPDATE
          SET attempt_count = LEAST(limits.attempt_count + 1, $4::int + 1)
        RETURNING attempt_count <= $4::int AS allowed,
          GREATEST(1, ceil(extract(epoch FROM window_expires_at - statement_timestamp())))::int AS retry_after
      `, [action, hash, this.policy.windowSeconds, this.policy.limit]);
      return { allowed: result.rows[0].allowed, retryAfterSeconds: result.rows[0].retry_after };
    } catch {
      throw new AuthError(503, "AUTH_RATE_LIMIT_UNAVAILABLE", "Authentication is temporarily unavailable.");
    }
  }

  async enforce(action: string, identity: string) {
    const result = await this.take(action, identity);
    if (!result.allowed) throw new AuthRateLimitError(result.retryAfterSeconds);
  }
}

export class AuthRateLimitError extends AuthError {
  constructor(public readonly retryAfterSeconds: number) {
    super(429, "RATE_LIMITED", "Too many requests. Try again later.");
  }
}

export async function cleanupAuthRateLimits(pool: Pool, batchSize = 1000) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 10_000) throw new Error("Invalid cleanup batch size.");
  const result = await pool.query(`
    WITH expired AS (
      SELECT action, key_hash, window_started_at FROM customer_auth_rate_limits
      WHERE window_expires_at <= statement_timestamp()
      ORDER BY window_expires_at LIMIT $1 FOR UPDATE SKIP LOCKED
    )
    DELETE FROM customer_auth_rate_limits AS limits USING expired
    WHERE limits.action = expired.action AND limits.key_hash = expired.key_hash
      AND limits.window_started_at = expired.window_started_at
  `, [batchSize]);
  return result.rowCount ?? 0;
}
