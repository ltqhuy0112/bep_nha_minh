import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

type AuthEmailPurpose = "VERIFY_EMAIL" | "RESET_PASSWORD";
type AuthEmailLocale = "vi" | "en";

export type EmailQueueConfig = {
  encryptionKey: string;
  publicWebUrl: string;
};

export interface EmailProvider {
  /**
   * Retries reuse the same key. Providers must deduplicate this key for at least the auth token lifetime.
   * Delivery remains at-least-once if a process pauses or partitions after the provider accepts a request.
   */
  send(input: { idempotencyKey: string; to: string; subject: string; text: string }): Promise<void>;
}

export type EmailDispatchPolicy = {
  batchSize: number;
  maxAttempts: number;
  baseDelaySeconds: number;
  maxDelaySeconds: number;
  leaseSeconds: number;
};

type QueueInput = {
  accountId: string;
  token: string;
  purpose: AuthEmailPurpose;
  email: string;
  locale: AuthEmailLocale;
};

type EncryptedPayload = { v: 1; iv: string; ciphertext: string; tag: string };
type AuthEmailPayload = QueueInput & { tokenHash: string };
type ClaimedEvent = { event_id: string; payload: EncryptedPayload; lease_token: string };

const AUTH_EMAIL_EVENT_TYPE = "CUSTOMER_AUTH_EMAIL";
const AUTH_EMAIL_AGGREGATE_TYPE = "CUSTOMER_ACCOUNT";
const PROVIDER_TIMEOUT_MS = 10_000;
const MIN_LEASE_SECONDS = 30;
const MAX_LEASE_SECONDS = 300;

export async function queueAuthEmail(
  client: PoolClient,
  input: QueueInput,
  config: EmailQueueConfig
): Promise<string> {
  const key = decodeEncryptionKey(config.encryptionKey);
  validateQueueInput(input);
  validatePublicWebUrl(config.publicWebUrl);

  const eventId = randomUUID();
  const payload = encryptPayload(key, {
    ...input,
    tokenHash: hashToken(input.token)
  });

  await client.query(
    `INSERT INTO outbox_events
      (event_id, aggregate_type, aggregate_id, aggregate_version, event_type, schema_version, payload, next_attempt_at)
     VALUES ($1, $2, $3, 1, $4, 1, $5::jsonb, now())`,
    [eventId, AUTH_EMAIL_AGGREGATE_TYPE, input.accountId, AUTH_EMAIL_EVENT_TYPE, JSON.stringify(payload)]
  );
  return eventId;
}

export async function dispatchAuthEmails(
  pool: Pool,
  config: EmailQueueConfig & { provider: EmailProvider; policy: EmailDispatchPolicy; signal?: AbortSignal }
): Promise<{ sent: number; retried: number; quarantined: number }> {
  const key = decodeEncryptionKey(config.encryptionKey);
  validatePublicWebUrl(config.publicWebUrl);
  validatePolicy(config.policy);
  if (config.signal?.aborted) return { sent: 0, retried: 0, quarantined: 0 };

  const events = await claimDueEvents(pool, config.policy);
  const result = { sent: 0, retried: 0, quarantined: 0 };

  for (const event of events) {
    // A worker finishes at most its active provider call before relinquishing remaining leases.
    if (config.signal?.aborted) break;
    let payload: AuthEmailPayload;
    try {
      payload = decryptPayload(key, event.payload);
    } catch {
      if (await quarantine(pool, event, "PAYLOAD_UNREADABLE", false)) result.quarantined++;
      continue;
    }

    if (!await isLiveAuthToken(pool, payload)) {
      if (await quarantine(pool, event, "AUTH_TOKEN_NOT_SENDABLE")) result.quarantined++;
      continue;
    }

    if (!await renewLease(pool, event, config.policy.leaseSeconds)) continue;

    try {
      await withTimeout(
        config.provider.send({
          idempotencyKey: `${AUTH_EMAIL_EVENT_TYPE}/${event.event_id}`,
          to: payload.email,
          ...messageFor(payload, config.publicWebUrl)
        }),
        PROVIDER_TIMEOUT_MS
      );
      if (await complete(pool, event)) result.sent++;
    } catch {
      const outcome = await retryOrQuarantine(pool, event, config.policy);
      if (outcome) result[outcome]++;
    }
  }

  return result;
}

async function claimDueEvents(pool: Pool, policy: EmailDispatchPolicy): Promise<ClaimedEvent[]> {
  const client = await pool.connect();
  const leaseOwner = `customer-auth-email:${randomUUID()}`;
  try {
    await client.query("BEGIN");
    const result = await client.query<ClaimedEvent>(
      `WITH due AS (
         SELECT event_id
         FROM outbox_events
         WHERE event_type = $1
           AND aggregate_type = $2
           AND published_at IS NULL
           AND quarantined_at IS NULL
           AND next_attempt_at <= now()
           AND (lease_until IS NULL OR lease_until < now())
         ORDER BY next_attempt_at, event_id
         FOR UPDATE SKIP LOCKED
         LIMIT $3
       )
       UPDATE outbox_events event
       SET lease_owner = $4,
           lease_token = gen_random_uuid(),
           lease_until = now() + ($5::text || ' seconds')::interval
       FROM due
       WHERE event.event_id = due.event_id
       RETURNING event.event_id, event.payload, event.lease_token`,
      [AUTH_EMAIL_EVENT_TYPE, AUTH_EMAIL_AGGREGATE_TYPE, policy.batchSize, leaseOwner, policy.leaseSeconds]
    );
    await client.query("COMMIT");
    return result.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function isLiveAuthToken(pool: Pool, payload: AuthEmailPayload): Promise<boolean> {
  const result = await pool.query<{ sendable: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM customer_auth_tokens token
       JOIN customer_accounts account ON account.id = token.account_id
       WHERE token.account_id = $1 AND token.purpose = $2 AND token.token_hash = $3
         AND token.target_email IS NOT DISTINCT FROM $4
         AND account.normalized_email IS NOT DISTINCT FROM $4 AND account.status = 'ACTIVE'
         AND token.consumed_at IS NULL AND token.revoked_at IS NULL AND token.expires_at > now()
     ) AS sendable`,
    [payload.accountId, payload.purpose, payload.tokenHash, payload.email]
  );
  return result.rows[0]?.sendable === true;
}

async function renewLease(pool: Pool, event: ClaimedEvent, leaseSeconds: number): Promise<boolean> {
  const result = await pool.query(
    `UPDATE outbox_events
     SET lease_until = now() + ($1::text || ' seconds')::interval
     WHERE event_id = $2 AND lease_token = $3 AND lease_until > now()
       AND published_at IS NULL AND quarantined_at IS NULL`,
    [leaseSeconds, event.event_id, event.lease_token]
  );
  return result.rowCount === 1;
}

async function complete(pool: Pool, event: ClaimedEvent): Promise<boolean> {
  const result = await pool.query(
    `UPDATE outbox_events
     SET published_at = now(), payload = $1::jsonb, lease_owner = NULL, lease_until = NULL, lease_token = NULL, last_error = NULL
     WHERE event_id = $2 AND lease_token = $3 AND lease_until > now()
       AND published_at IS NULL AND quarantined_at IS NULL`,
    [JSON.stringify({ receipt: { status: "SENT" } }), event.event_id, event.lease_token]
  );
  return result.rowCount === 1;
}

async function quarantine(pool: Pool, event: ClaimedEvent, reason: string, clearPayload = true): Promise<boolean> {
  const result = await pool.query(
    `UPDATE outbox_events
     SET quarantined_at = now(), payload = CASE WHEN $1 THEN $2::jsonb ELSE payload END, last_error = $3,
         lease_owner = NULL, lease_until = NULL, lease_token = NULL
     WHERE event_id = $4 AND lease_token = $5 AND lease_until > now()
       AND published_at IS NULL AND quarantined_at IS NULL`,
    [clearPayload, JSON.stringify({ receipt: { status: "QUARANTINED" } }), reason, event.event_id, event.lease_token]
  );
  return result.rowCount === 1;
}

async function retryOrQuarantine(
  pool: Pool,
  event: ClaimedEvent,
  policy: EmailDispatchPolicy
): Promise<"retried" | "quarantined" | null> {
  const result = await pool.query<{ quarantined: boolean }>(
    `UPDATE outbox_events
     SET attempts = attempts + 1,
         next_attempt_at = CASE WHEN attempts + 1 >= $1 THEN next_attempt_at
           ELSE now() + (LEAST($2::numeric * power(2::numeric, LEAST(attempts, 20)), $3::numeric)::text || ' seconds')::interval END,
         quarantined_at = CASE WHEN attempts + 1 >= $1 THEN now() ELSE NULL END,
         payload = CASE WHEN attempts + 1 >= $1 THEN $4::jsonb ELSE payload END,
         last_error = 'EMAIL_DELIVERY_FAILED', lease_owner = NULL, lease_until = NULL, lease_token = NULL
     WHERE event_id = $5 AND lease_token = $6 AND lease_until > now()
       AND published_at IS NULL AND quarantined_at IS NULL
     RETURNING quarantined_at IS NOT NULL AS quarantined`,
    [policy.maxAttempts, policy.baseDelaySeconds, policy.maxDelaySeconds,
      JSON.stringify({ receipt: { status: "QUARANTINED" } }), event.event_id, event.lease_token]
  );
  if (!result.rows[0]) return null;
  return result.rows[0].quarantined ? "quarantined" : "retried";
}

function encryptPayload(key: Buffer, payload: AuthEmailPayload): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return { v: 1, iv: iv.toString("base64"), ciphertext: ciphertext.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}

function decryptPayload(key: Buffer, payload: EncryptedPayload): AuthEmailPayload {
  if (payload?.v !== 1 || !isBase64(payload.iv) || !isBase64(payload.ciphertext) || !isBase64(payload.tag)) {
    throw new Error("Invalid encrypted payload.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decoded: unknown = JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")), decipher.final()
  ]).toString("utf8"));
  validateDecryptedPayload(decoded);
  return decoded;
}

function decodeEncryptionKey(value: string): Buffer {
  if (!isBase64(value)) throw new Error("Email encryption key must be a base64-encoded 32-byte key.");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("Email encryption key must be a base64-encoded 32-byte key.");
  return key;
}

function isBase64(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Buffer.from(value, "base64").toString("base64") === value;
}

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function validateQueueInput(input: QueueInput) {
  if (!input.accountId || !input.token || !input.email || !["VERIFY_EMAIL", "RESET_PASSWORD"].includes(input.purpose) || !["vi", "en"].includes(input.locale)) {
    throw new Error("Invalid customer auth email input.");
  }
}

function validateDecryptedPayload(value: unknown): asserts value is AuthEmailPayload {
  if (!value || typeof value !== "object") throw new Error("Invalid encrypted payload.");
  const payload = value as Partial<AuthEmailPayload>;
  validateQueueInput(payload as QueueInput);
  if (typeof payload.tokenHash !== "string" || !/^[a-f0-9]{64}$/.test(payload.tokenHash)) {
    throw new Error("Invalid encrypted payload.");
  }
}

function validatePublicWebUrl(value: string) {
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw new Error("publicWebUrl must be an http(s) URL without credentials.");
  }
}

function validatePolicy(policy: EmailDispatchPolicy) {
  for (const value of Object.values(policy)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error("Email dispatch policy values must be positive integers.");
  }
  if (policy.batchSize > 100 || policy.maxAttempts > 20 || policy.baseDelaySeconds > policy.maxDelaySeconds ||
    policy.leaseSeconds < MIN_LEASE_SECONDS || policy.leaseSeconds > MAX_LEASE_SECONDS) {
    throw new Error("Invalid email dispatch policy.");
  }
}

function messageFor(payload: AuthEmailPayload, publicWebUrl: string) {
  const mode = payload.purpose === "VERIFY_EMAIL" ? "verify-email" : "reset-password";
  const url = new URL(`/${payload.locale}/auth/${mode}`, publicWebUrl);
  url.hash = `token=${encodeURIComponent(payload.token)}`;
  const verify = payload.purpose === "VERIFY_EMAIL";
  if (payload.locale === "vi") {
    return {
      subject: verify ? "Xac minh dia chi email" : "Dat lai mat khau",
      text: `${verify ? "Xac minh email cua ban" : "Dat lai mat khau cua ban"}: ${url.toString()}`
    };
  }
  return {
    subject: verify ? "Verify your email address" : "Reset your password",
    text: `${verify ? "Verify your email" : "Reset your password"}: ${url.toString()}`
  };
}

async function withTimeout<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error("Email provider timed out.")), milliseconds); })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function createResendEmailProvider(options: {
  apiKey: string;
  from: string;
  fetchImpl?: typeof fetch;
}): EmailProvider {
  if (!options.apiKey || !options.from) throw new Error("Resend API key and sender are required.");
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async send(input) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
      try {
        const response = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            authorization: `Bearer ${options.apiKey}`,
            "content-type": "application/json",
            "idempotency-key": input.idempotencyKey
          },
          body: JSON.stringify({ from: options.from, to: [input.to], subject: input.subject, text: input.text }),
          signal: controller.signal
        });
        if (!response.ok) throw new Error("Resend email delivery failed.");
      } finally {
        clearTimeout(timer);
      }
    }
  };
}
