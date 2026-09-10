import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { cleanupOAuthTransactions } from "./oauth-transactions";
import { cleanupAuthRateLimits } from "./rate-limit";

export type AuthEmailAlertPolicy = {
  backlogWarningCount: number;
  backlogUrgentCount: number;
  oldestWarningSeconds: number;
  oldestUrgentSeconds: number;
  dispatcherFailureAlertThreshold: number;
};

export type AuthEmailOperationsInput = {
  dispatcherId: string;
  dispatcherFailureCount: number;
  policy: AuthEmailAlertPolicy;
};

type AlertCondition = {
  code: "AUTH_EMAIL_BACKLOG" | "AUTH_EMAIL_QUARANTINED" | "AUTH_EMAIL_DISPATCHER_FAILURE";
  dedupeKey: string;
  active: boolean | null;
  severity: "WARNING" | "URGENT";
  details: Record<string, number>;
};

type EmailOperationalSnapshot = {
  pending_count: number;
  actionable_quarantined_count: number;
  oldest_pending_seconds: number;
};

const ALERT_ENTITY_TYPE = "CUSTOMER_AUTH_EMAIL";
const RECOVERED_REASON = "SYSTEM_RECOVERED";
const ADVISORY_LOCK_KEY = "bep-nha-minh:customer-auth-email-operations:v1";

export function readAuthEmailAlertPolicy(env: NodeJS.ProcessEnv): AuthEmailAlertPolicy {
  const warningCount = readPositiveInteger(env, "CUSTOMER_AUTH_EMAIL_BACKLOG_WARNING_COUNT");
  const urgentCount = readPositiveInteger(env, "CUSTOMER_AUTH_EMAIL_BACKLOG_URGENT_COUNT");
  const warningAge = readPositiveInteger(env, "CUSTOMER_AUTH_EMAIL_BACKLOG_WARNING_AGE_SECONDS");
  const urgentAge = readPositiveInteger(env, "CUSTOMER_AUTH_EMAIL_BACKLOG_URGENT_AGE_SECONDS");
  const dispatcherFailures = readPositiveInteger(env, "CUSTOMER_AUTH_EMAIL_DISPATCHER_FAILURE_ALERT_THRESHOLD");
  const policy = {
    backlogWarningCount: warningCount,
    backlogUrgentCount: urgentCount,
    oldestWarningSeconds: warningAge,
    oldestUrgentSeconds: urgentAge,
    dispatcherFailureAlertThreshold: dispatcherFailures
  };
  validateAuthEmailAlertPolicy(policy);
  return policy;
}

export async function monitorAuthEmailOperations(pool: Pool, input: AuthEmailOperationsInput) {
  validateAuthEmailAlertPolicy(input.policy);
  if (!Number.isSafeInteger(input.dispatcherFailureCount) || input.dispatcherFailureCount < 0) {
    throw new Error("Invalid dispatcher failure count.");
  }
  validateAuthEmailDispatcherId(input.dispatcherId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ADVISORY_LOCK_KEY]);
    const snapshot = await readSnapshot(client);
    const conditions = buildConditions(snapshot, input);
    for (const condition of conditions) await synchronizeAlert(client, condition);
    await client.query("COMMIT");
    return snapshot;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function cleanupCustomerAuthEphemeralState(pool: Pool, batchSize = 1000) {
  const [oauthTransactions, rateLimits] = await Promise.all([
    cleanupOAuthTransactions(pool, batchSize),
    cleanupAuthRateLimits(pool, batchSize)
  ]);
  return { oauthTransactions, rateLimits };
}

export async function waitForAuthEmailPoll(seconds: number, signal: AbortSignal) {
  if (!Number.isSafeInteger(seconds) || seconds < 1) throw new Error("Invalid auth email poll interval.");
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const onAbort = () => finish();
    const timer = setTimeout(finish, seconds * 1000);
    function finish() {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve();
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function readSnapshot(client: PoolClient): Promise<EmailOperationalSnapshot> {
  const result = await client.query<EmailOperationalSnapshot>(`
    SELECT
      count(*) FILTER (WHERE published_at IS NULL AND quarantined_at IS NULL)::int AS pending_count,
      count(*) FILTER (WHERE quarantined_at IS NOT NULL AND last_error IN ('PAYLOAD_UNREADABLE', 'EMAIL_DELIVERY_FAILED'))::int AS actionable_quarantined_count,
      coalesce(floor(extract(epoch FROM statement_timestamp() - min(created_at) FILTER (
        WHERE published_at IS NULL AND quarantined_at IS NULL
      )))::int, 0) AS oldest_pending_seconds
    FROM outbox_events
    WHERE event_type = 'CUSTOMER_AUTH_EMAIL' AND aggregate_type = 'CUSTOMER_ACCOUNT'
  `);
  return result.rows[0] ?? { pending_count: 0, actionable_quarantined_count: 0, oldest_pending_seconds: 0 };
}

function buildConditions(snapshot: EmailOperationalSnapshot, input: AuthEmailOperationsInput): AlertCondition[] {
  const oldest = snapshot.oldest_pending_seconds;
  const backlogUrgent = snapshot.pending_count >= input.policy.backlogUrgentCount || oldest >= input.policy.oldestUrgentSeconds;
  const backlogWarning = snapshot.pending_count >= input.policy.backlogWarningCount || oldest >= input.policy.oldestWarningSeconds;
  return [
    {
      code: "AUTH_EMAIL_BACKLOG", dedupeKey: "customer-auth-email:backlog", active: backlogWarning,
      severity: backlogUrgent ? "URGENT" : "WARNING",
      details: { pendingCount: snapshot.pending_count, oldestPendingSeconds: oldest }
    },
    {
      code: "AUTH_EMAIL_QUARANTINED", dedupeKey: "customer-auth-email:quarantined", active: snapshot.actionable_quarantined_count > 0,
      severity: "URGENT", details: { actionableQuarantinedCount: snapshot.actionable_quarantined_count }
    },
    {
      code: "AUTH_EMAIL_DISPATCHER_FAILURE", dedupeKey: `customer-auth-email:dispatcher-failure:${workerScope(input.dispatcherId)}`,
      active: input.dispatcherFailureCount === 0 ? false :
        input.dispatcherFailureCount >= input.policy.dispatcherFailureAlertThreshold ? true : null,
      severity: "URGENT", details: { consecutiveFailures: input.dispatcherFailureCount }
    }
  ];
}

async function synchronizeAlert(client: PoolClient, condition: AlertCondition) {
  if (condition.active === null) return;
  if (condition.active) {
    await client.query(`
      INSERT INTO admin_alerts (id, entity_type, dedupe_key, code, severity, status, details)
      VALUES ($1, $2, $3, $4, $5, 'OPEN', $6::jsonb)
      ON CONFLICT (dedupe_key) WHERE status IN ('OPEN', 'ACKNOWLEDGED') DO UPDATE
      SET severity = EXCLUDED.severity, details = EXCLUDED.details
    `, [randomUUID(), ALERT_ENTITY_TYPE, condition.dedupeKey, condition.code, condition.severity, JSON.stringify(condition.details)]);
    return;
  }
  await client.query(`
    UPDATE admin_alerts SET status='RESOLVED', resolved_at=clock_timestamp(), resolution_reason=$1
    WHERE dedupe_key=$2 AND status IN ('OPEN', 'ACKNOWLEDGED')
  `, [RECOVERED_REASON, condition.dedupeKey]);
}

function validateAuthEmailAlertPolicy(policy: AuthEmailAlertPolicy) {
  for (const value of Object.values(policy)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error("Invalid auth email alert policy.");
  }
  if (policy.backlogUrgentCount < policy.backlogWarningCount || policy.oldestUrgentSeconds < policy.oldestWarningSeconds) {
    throw new Error("Urgent auth email alert thresholds must not be lower than warning thresholds.");
  }
}

function readPositiveInteger(env: NodeJS.ProcessEnv, name: string) {
  const value = Number(env[name]);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  return value;
}

function workerScope(dispatcherId: string) {
  return createHash("sha256").update(dispatcherId, "utf8").digest("hex").slice(0, 24);
}

export function validateAuthEmailDispatcherId(dispatcherId: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(dispatcherId)) {
    throw new Error("Invalid dispatcher identifier.");
  }
}

export function redactOperationalError(error: unknown) {
  const fingerprint = createHash("sha256").update(error instanceof Error ? error.name : "unknown").digest("hex").slice(0, 12);
  return `operational-error:${fingerprint}`;
}
