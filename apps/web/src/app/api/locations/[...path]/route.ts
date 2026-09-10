import "server-only";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const error = (status: number, code: string) => Response.json({ version: "v1", error: { code, message: "Location lookup failed." } }, { status, headers: { "cache-control": "no-store" } });
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (request.nextUrl.search) return error(400, "VALIDATION_ERROR");
  if (!(path.length === 1 && path[0] === "provinces") && !(path.length === 3 && path[0] === "provinces" && /^[0-9]{2}$/.test(path[1]) && path[2] === "wards")) return error(404, "NOT_FOUND");
  try {
    const upstream = new URL(process.env.COMMERCE_API_URL ?? "http://127.0.0.1:3001");
    if (!["http:", "https:"].includes(upstream.protocol) || upstream.username || upstream.password || upstream.pathname !== "/" || upstream.search || upstream.hash) return error(503, "NOT_CONFIGURED");
    const response = await fetch(new URL(`/api/v1/locations/${path.join("/")}`, upstream), { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    if (data?.version !== "v1" || (!Object.hasOwn(data, "data") && !Object.hasOwn(data, "error"))) return error(502, "UPSTREAM_UNAVAILABLE");
    return Response.json(data, { status: response.status, headers: { "cache-control": response.ok ? "public, max-age=300" : "no-store", "x-content-type-options": "nosniff" } });
  } catch { return error(503, "LOCATIONS_UNAVAILABLE"); }
}
