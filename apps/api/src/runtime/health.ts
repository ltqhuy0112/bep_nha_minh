import { liveHealth, type HealthStatus } from "../contracts/v1/health";

export interface ReadinessDatabase {
  query(statement: string): Promise<unknown>;
}

export interface HealthDependencies {
  database?: ReadinessDatabase;
  readinessTimeoutMs?: number;
}

const DEFAULT_READINESS_TIMEOUT_MS = 1_000;

export function getLiveHealth(): HealthStatus {
  return liveHealth;
}

export async function isReady({
  database,
  readinessTimeoutMs = DEFAULT_READINESS_TIMEOUT_MS
}: HealthDependencies): Promise<boolean> {
  if (!database) {
    return false;
  }

  const timeoutMs = Math.max(1, readinessTimeoutMs);
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      database.query("SELECT 1"),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Readiness check timed out.")), timeoutMs);
      })
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
