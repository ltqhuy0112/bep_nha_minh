import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import pg, { type Pool } from "pg";
import { z } from "zod";
import { locationSource } from "./source";

const name = z.string().trim().min(1).max(255);
const ward = z.object({ Code: z.string().regex(/^\d{5}$/), ProvinceCode: z.string().regex(/^\d{2}$/), FullName: name, FullNameEn: name });
const datasetSchema = z.array(z.object({ Code: z.string().regex(/^\d{2}$/), FullName: name, FullNameEn: name, Wards: z.array(ward).min(1) })).length(34);

export async function syncLocations(pool: Pool) {
  const raw = await readFile(path.join(locationSource.directory, "vietnam.json"), "utf8");
  const manifest = JSON.parse(await readFile(path.join(locationSource.directory, "manifest.json"), "utf8"));
  const checksum = createHash("sha256").update(raw).digest("hex");
  if (manifest.revision !== locationSource.revision || manifest.sourceUrl !== locationSource.url || checksum !== manifest.sha256) throw new Error("Dataset checksum/source mismatch");
  const provinces = datasetSchema.parse(JSON.parse(raw));
  const provinceCodes = new Set<string>(), wardCodes = new Set<string>();
  for (const province of provinces) {
    if (provinceCodes.has(province.Code)) throw new Error("Duplicate province code");
    provinceCodes.add(province.Code);
    for (const item of province.Wards) {
      if (item.ProvinceCode !== province.Code || wardCodes.has(item.Code)) throw new Error("Invalid ward relationship");
      wardCodes.add(item.Code);
    }
  }
  if (provinces.length !== manifest.provinces || wardCodes.size !== manifest.wards || wardCodes.size < 3000) throw new Error("Incomplete dataset");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('vietnam-locations-sync',0))");
    const existing = await client.query("SELECT checksum FROM location_datasets WHERE id=$1", [manifest.revision]);
    if (existing.rowCount && existing.rows[0].checksum !== checksum) throw new Error("Immutable dataset revision mismatch");
    if (!existing.rowCount) {
      await client.query("INSERT INTO location_datasets(id,source_url,checksum) VALUES ($1,$2,$3)", [manifest.revision, manifest.sourceUrl, checksum]);
      const provinceRows = provinces.map((p) => ({ code: p.Code, name_vi: p.FullName, name_en: p.FullNameEn }));
      const wardRows = provinces.flatMap((p) => p.Wards.map((w) => ({ code: w.Code, province_code: p.Code, name_vi: w.FullName, name_en: w.FullNameEn })));
      await client.query(`INSERT INTO location_provinces(dataset_id,code,name_vi,name_en)
        SELECT $1,code,name_vi,name_en FROM jsonb_to_recordset($2::jsonb) AS x(code text,name_vi text,name_en text)`, [manifest.revision, JSON.stringify(provinceRows)]);
      await client.query(`INSERT INTO location_wards(dataset_id,province_code,code,name_vi,name_en)
        SELECT $1,province_code,code,name_vi,name_en FROM jsonb_to_recordset($2::jsonb) AS x(province_code text,code text,name_vi text,name_en text)`, [manifest.revision, JSON.stringify(wardRows)]);
    }
    const counts = await client.query(`SELECT (SELECT count(*)::int FROM location_provinces WHERE dataset_id=$1) AS provinces,
      (SELECT count(*)::int FROM location_wards WHERE dataset_id=$1) AS wards`, [manifest.revision]);
    if (counts.rows[0].provinces !== manifest.provinces || counts.rows[0].wards !== manifest.wards) throw new Error("Stored dataset is incomplete");
    await client.query("UPDATE location_datasets SET active=false WHERE active AND id<>$1", [manifest.revision]);
    await client.query("UPDATE location_datasets SET active=true WHERE id=$1", [manifest.revision]);
    await client.query("COMMIT");
    return { revision: manifest.revision, provinces: manifest.provinces, wards: manifest.wards };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function main() {
  if (process.argv.length > 2) {
    throw new Error("No flags supported");
  }

  const url = new URL(
      process.env.DATABASE_URL ??
      "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh"
  );

  const deploymentStage =
      process.env.DEPLOYMENT_STAGE ??
      (process.env.NODE_ENV === "production" ? "production" : "development");

  const isLocalHost = [
    "localhost",
    "127.0.0.1",
    "[::1]",
    "postgres"
  ].includes(url.hostname);

  const syncAllowed =
      deploymentStage === "development" ||
      deploymentStage === "prelaunch";

  if (!syncAllowed) {
    throw new Error(
        "Location sync is only allowed in development/prelaunch environments"
    );
  }

  if (deploymentStage === "development" && !isLocalHost) {
    throw new Error(
        "Development location sync requires a local database"
    );
  }

  const pool = new pg.Pool({
    connectionString: url.toString(),
    max: 1,
    connectionTimeoutMillis: 3000,
    statement_timeout: 30000
  });

  try {
    console.log(JSON.stringify(await syncLocations(pool)));
  } finally {
    await pool.end();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  void main().catch((error) => {
    console.error("Location sync failed:", error);
    process.exitCode = 1;
  });
}
