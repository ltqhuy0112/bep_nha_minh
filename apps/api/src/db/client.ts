import pg, { type PoolClient, type QueryResultRow } from "pg";
import { getServerEnv } from "@bep-nha-minh/api/lib/env";

const { Pool } = pg;

declare global {
  var bepNhaMinhPool: pg.Pool | undefined;
}

function getPool() {
  const env = getServerEnv();

  if (!globalThis.bepNhaMinhPool) {
    globalThis.bepNhaMinhPool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000
    });
  }

  return globalThis.bepNhaMinhPool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  values: unknown[] = []
) {
  return getPool().query<T>(text, values);
}

export type TransactionClient = Pick<PoolClient, "query">;

export async function transaction<T>(
  callback: (client: TransactionClient) => Promise<T>
) {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
