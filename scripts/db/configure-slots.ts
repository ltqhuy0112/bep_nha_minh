import "dotenv/config";
import pg from "pg";
import { configureApprovedFulfillmentSlots } from "./fulfillment-slots";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL must be explicitly configured.");
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    const inserted = await configureApprovedFulfillmentSlots(client);
    await client.query("COMMIT");
    console.log(`Approved delivery slots: ${inserted} inserted. Existing settings preserved. No stock, prices or order acceptance changed.`);
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof Error && error.message.startsWith("Conflicting schedule")) throw error;
    throw new Error("Slot configuration failed; check database access and migrations. No changes committed.");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error && (error.message.startsWith("Conflicting schedule") || error.message.startsWith("Slot configuration") || error.message.startsWith("DATABASE_URL"))
    ? error.message : "Slot configuration failed; check database connection.");
  process.exitCode = 1;
});
