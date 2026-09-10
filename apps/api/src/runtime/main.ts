import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { config } from "dotenv";
import pg from "pg";
import { createApiServer } from "./http-server";

const rootDirectory = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
config({ path: resolve(rootDirectory, ".env"), override: false, quiet: true });

const { Pool } = pg;
const readinessTimeoutMs = readBoundedPositiveInteger(
  process.env.API_READY_TIMEOUT_MS,
  1_000,
  10_000
);
const pool = new Pool({
  connectionString: getDatabaseUrl(),
  max: readBoundedPositiveInteger(process.env.API_DB_POOL_MAX, 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: readinessTimeoutMs,
  statement_timeout: readinessTimeoutMs
});
pool.on("error", () => {
  console.error("API database pool error.");
});
const server = createApiServer({
  database: {
    query: (statement) => pool.query(statement)
  },
  catalogDatabase: pool,
  readinessTimeoutMs
});
const port = readPort(process.env.API_PORT);
const host = process.env.API_HOST ?? "127.0.0.1";

let stopping = false;

async function shutdown(exitCode: number) {
  if (stopping) {
    return;
  }
  stopping = true;
  await closeServerWithin(server, 5_000);
  await settleWithin(pool.end(), 5_000);
  process.exit(exitCode);
}

async function start() {
  await new Promise<void>((resolveListen, rejectListen) => {
    const onError = () => {
      server.off("listening", onListening);
      rejectListen(new Error("API failed to start."));
    };
    const onListening = () => {
      server.off("error", onError);
      resolveListen();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
  console.log(`API listening on http://${host}:${port}`);
}

process.once("SIGINT", () => void shutdown(0));
process.once("SIGTERM", () => void shutdown(0));
void start().catch(() => void shutdown(1));

function readPort(value: string | undefined): number {
  const parsed = Number(value ?? "3001");
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : 3001;
}

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    try {
      const parsed = new URL(databaseUrl);
      if (parsed.protocol === "postgres:" || parsed.protocol === "postgresql:") {
        return databaseUrl;
      }
    } catch {
      // The generic error below avoids exposing connection details.
    }
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL.");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production.");
  }
  return "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh";
}

function readBoundedPositiveInteger(
  value: string | undefined,
  fallback: number,
  maximum = 100
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

async function closeServerWithin(serverToClose: typeof server, timeoutMs: number) {
  await new Promise<void>((resolveClose) => {
    const timer = setTimeout(() => {
      serverToClose.closeAllConnections();
      resolveClose();
    }, timeoutMs);

    serverToClose.close(() => {
      clearTimeout(timer);
      resolveClose();
    });
  });
}

async function settleWithin(promise: Promise<unknown>, timeoutMs: number) {
  await Promise.race([
    promise.catch(() => undefined),
    new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, timeoutMs))
  ]);
}
