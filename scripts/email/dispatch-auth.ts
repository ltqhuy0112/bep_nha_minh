import "dotenv/config";
import pg from "pg";
import { readCustomerAuthConfig } from "../../apps/api/src/features/customer-auth/config";
import { createResendEmailProvider, dispatchAuthEmails } from "../../apps/api/src/features/customer-auth/email";
import { cleanupCustomerAuthEphemeralState, monitorAuthEmailOperations, readAuthEmailAlertPolicy, redactOperationalError, validateAuthEmailDispatcherId, waitForAuthEmailPoll } from "../../apps/api/src/features/customer-auth/email-operations";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
function integer(name: string, maximum = 86_400) {
  const value = Number(required(name));
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new Error(`${name} must be an integer between 1 and ${maximum}.`);
  return value;
}
function boundedDelay(base: number, cap: number, failures: number) {
  if (cap < base) throw new Error("CUSTOMER_AUTH_EMAIL_FAILURE_CAP_SECONDS must not be lower than CUSTOMER_AUTH_EMAIL_FAILURE_BASE_SECONDS.");
  return Math.min(base * 2 ** Math.min(failures - 1, 20), cap);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--watch")) {
    throw new Error("Only --watch is supported; no dry-run mode exists.");
  }
  if (process.env.NODE_ENV === "production" || process.env.CUSTOMER_AUTH_EMAIL_DISPATCH_ENABLED !== "true") {
    throw new Error("Email dispatch is gated. Explicit local enablement is required; production is not approved.");
  }
  if (required("EMAIL_PROVIDER") !== "resend") throw new Error("Only the opt-in Resend adapter is implemented.");
  const email = readCustomerAuthConfig(process.env).email;
  if (!email) throw new Error("CUSTOMER_AUTH_EMAIL_KEY is required.");
  const config = {
    ...email,
    provider: createResendEmailProvider({ apiKey: required("RESEND_API_KEY"), from: required("EMAIL_FROM") }),
    policy: {
      batchSize: integer("CUSTOMER_AUTH_EMAIL_BATCH_SIZE"),
      maxAttempts: integer("CUSTOMER_AUTH_EMAIL_MAX_ATTEMPTS"),
      baseDelaySeconds: integer("CUSTOMER_AUTH_EMAIL_RETRY_BASE_SECONDS"),
      maxDelaySeconds: integer("CUSTOMER_AUTH_EMAIL_RETRY_CAP_SECONDS"),
      leaseSeconds: integer("CUSTOMER_AUTH_EMAIL_LEASE_SECONDS")
    }
  };
  const watch = args.length === 1;
  const pollSeconds = watch ? integer("CUSTOMER_AUTH_EMAIL_POLL_SECONDS") : 0;
  const dispatcherId = required("CUSTOMER_AUTH_EMAIL_WORKER_ID");
  validateAuthEmailDispatcherId(dispatcherId);
  const failureBaseSeconds = integer("CUSTOMER_AUTH_EMAIL_FAILURE_BASE_SECONDS");
  const failureCapSeconds = integer("CUSTOMER_AUTH_EMAIL_FAILURE_CAP_SECONDS");
  const failureMaxConsecutive = integer("CUSTOMER_AUTH_EMAIL_FAILURE_MAX_CONSECUTIVE", 100);
  boundedDelay(failureBaseSeconds, failureCapSeconds, 1);
  const alertPolicy = readAuthEmailAlertPolicy(process.env);
  const cleanupBatchSize = integer("CUSTOMER_AUTH_EMAIL_CLEANUP_BATCH_SIZE", 10_000);
  const pool = new pg.Pool({ connectionString: required("DATABASE_URL"), max: 2, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
  pool.on("error", () => console.error("Email database connection error."));
  const controller = new AbortController();
  let failures = 0;
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    do {
      try {
        const result = await dispatchAuthEmails(pool, { ...config, signal: controller.signal });
        const cleanup = await cleanupCustomerAuthEphemeralState(pool, cleanupBatchSize);
        const snapshot = await monitorAuthEmailOperations(pool, { dispatcherId, dispatcherFailureCount: 0, policy: alertPolicy });
        failures = 0;
        console.log(JSON.stringify({ ...result, cleanup, pending: snapshot.pending_count, actionableQuarantined: snapshot.actionable_quarantined_count }));
      } catch (error) {
        failures++;
        try { await monitorAuthEmailOperations(pool, { dispatcherId, dispatcherFailureCount: failures, policy: alertPolicy }); }
        catch { /* The database may be unavailable; retain the generic operational stderr only. */ }
        console.error(`Email dispatcher ${redactOperationalError(error)}.`);
        if (!watch || failures >= failureMaxConsecutive) {
          process.exitCode = 1;
          controller.abort();
        }
      }
      if (watch && !controller.signal.aborted) {
        await waitForAuthEmailPoll(failures === 0 ? pollSeconds : boundedDelay(failureBaseSeconds, failureCapSeconds, failures), controller.signal);
      }
    } while (watch && !controller.signal.aborted);
  }
  finally { await pool.end(); }
}

void main().catch(() => {
  console.error("Email dispatch failed. Check the enablement gate, provider, key, database and explicit retry policy; no message secrets were logged.");
  process.exitCode = 1;
});
