import type { IncomingMessage, ServerResponse } from "node:http";
import type { Pool } from "pg";
import type { LocationList, LocationOption } from "@bep-nha-minh/shared/types/locations";
import { errorEnvelope, successEnvelope } from "../../contracts/v1/envelope";

export function createLocationHandler(pool: Pick<Pool, "query">) {
  const cache = new Map<string, { expires: number; value: LocationList }>();
  const pending = new Map<string, Promise<LocationList>>();
  async function load(provinceCode: string | null): Promise<LocationList> {
    const key = provinceCode ?? "provinces";
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;
    const current = pending.get(key);
    if (current) return current;
    const promise = (async () => {
      const dataset = await pool.query<{ id: string }>("SELECT id FROM location_datasets WHERE active");
      if (!dataset.rows[0]) throw new LocationError(503, "LOCATIONS_NOT_READY");
      const datasetId = dataset.rows[0].id;
      if (provinceCode) {
        const exists = await pool.query("SELECT code FROM location_provinces WHERE dataset_id=$1 AND code=$2", [datasetId, provinceCode]);
        if (!exists.rowCount) throw new LocationError(404, "NOT_FOUND");
      }
      const result = provinceCode
        ? await pool.query<LocationOption>("SELECT code,name_vi AS name,name_en AS \"nameEn\" FROM location_wards WHERE dataset_id=$1 AND province_code=$2 ORDER BY code", [datasetId, provinceCode])
        : await pool.query<LocationOption>("SELECT code,name_vi AS name,name_en AS \"nameEn\" FROM location_provinces WHERE dataset_id=$1 ORDER BY code", [datasetId]);
      const value = { datasetId, items: result.rows };
      if (cache.size >= 128) cache.clear();
      cache.set(key, { expires: Date.now() + 300_000, value });
      return value;
    })();
    pending.set(key, promise);
    try { return await promise; } finally { pending.delete(key); }
  }
  return async (request: IncomingMessage, response: ServerResponse, url: URL) => {
    if (!url.pathname.startsWith("/api/v1/locations/")) return false;
    try {
      if (request.method !== "GET") { response.setHeader("Allow", "GET"); throw new LocationError(405, "METHOD_NOT_ALLOWED"); }
      if (url.search) throw new LocationError(400, "VALIDATION_ERROR");
      const match = /^\/api\/v1\/locations\/provinces\/([0-9]{2})\/wards$/.exec(url.pathname);
      if (!match && url.pathname !== "/api/v1/locations/provinces") throw new LocationError(404, "NOT_FOUND");
      const data = await load(match?.[1] ?? null);
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" });
      response.end(JSON.stringify(successEnvelope(data)));
    } catch (error) {
      const status = error instanceof LocationError ? error.status : 503;
      response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(JSON.stringify(errorEnvelope(error instanceof LocationError ? error.code : "LOCATIONS_UNAVAILABLE", "Location reference data is unavailable.")));
    }
    return true;
  };
}
class LocationError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); }
}
