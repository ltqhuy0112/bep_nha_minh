import "dotenv/config";
import pg from "pg";
import { siteContents } from "../../apps/api/src/data/site-content";

const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--for-cart") || args.length > 1) throw new Error("Usage: db:seed:catalog [--for-cart]");
const forCart = args.includes("--for-cart");

const databaseUrl = process.env.DATABASE_URL ??
  "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh";
const target = new URL(databaseUrl);
if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) {
  throw new Error("Demo catalog seed requires a local development database.");
}

const products = [
  { sku: "DEMO-CHICKEN", slug: "grilled-chicken-rice", price: 59000 },
  { sku: "DEMO-BEEF", slug: "beef-vegetable-rice", price: 69000 },
  { sku: "DEMO-SALAD", slug: "chicken-egg-salad", price: 55000 },
  { sku: "DEMO-SALMON", slug: "salmon-rice", price: 89000 }
];

async function main() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");
    let inserted = 0;
    let cartReady = 0;
    for (const [index, product] of products.entries()) {
      const result = await client.query<{ id: string }>(`
        INSERT INTO products(sku,slug,unit_price,accepting_orders)
        VALUES ($1,$2,$3,false) ON CONFLICT DO NOTHING RETURNING id`,
      [product.sku, product.slug, product.price]);
      const row = result.rows[0];
      if (row) for (const locale of ["vi", "en"] as const) {
        const dish = siteContents[locale].dishes[index];
        await client.query(`INSERT INTO product_translations(product_id,locale,name,description)
          VALUES ($1,$2,$3,$4)`, [row.id, locale, dish.name, dish.description]);
      }
      if (row) inserted++;
      if (forCart) {
        // Explicit local opt-in only; preserve prices, translations and operator blocks.
        const enabled = await client.query(`UPDATE products SET accepting_orders=true
          WHERE sku=$1 AND slug=$2 AND archived_at IS NULL AND fulfillment_blocked=false RETURNING id`,
        [product.sku, product.slug]);
        cartReady += enabled.rowCount ?? 0;
      }
    }
    await client.query("COMMIT");
    console.log(`Demo catalog: ${inserted} products inserted. ${forCart ? `${cartReady} demo products enabled for cart.` : "Existing availability unchanged; new products are disabled."} No slots, inventory or orders created.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(() => {
  console.error("Catalog seed failed. Check local database access and applied migrations.");
  process.exitCode = 1;
});
