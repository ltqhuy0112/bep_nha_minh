import "server-only";
import type { NextRequest } from "next/server";
import { boundedBody } from "@/lib/bff/request-body";
import { isHttpOrigin, forwardNumericRetryAfter, privateResponseHeaders as headers } from "@/lib/bff/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path?: string[] }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const error = (status: number, code: string) => Response.json({ version: "v1", error: { code, message: "Address request failed." } }, { status, headers });

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;

async function proxy(request: NextRequest, context: Context) {
  const { path = [] } = await context.params;
  if (request.nextUrl.search || path.length > 2 || (path.length && !uuid.test(path[0])) || (path.length === 2 && path[1] !== "default")) return error(400, "VALIDATION_ERROR");
  const allowed = !path.length ? ["GET", "POST"] : path.length === 1 ? ["PUT", "DELETE"] : ["PUT"];
  if (!allowed.includes(request.method)) {
    const response = error(405, "METHOD_NOT_ALLOWED");
    response.headers.set("Allow", allowed.join(", "));
    return response;
  }
  try {
    const publicUrl = new URL(process.env.PUBLIC_WEB_URL ?? "http://localhost:3000");
    const upstream = new URL(process.env.COMMERCE_API_URL ?? "http://127.0.0.1:3001");
    if (![publicUrl, upstream].every(isHttpOrigin)) return error(503, "AUTH_NOT_CONFIGURED");
    const mutation = request.method !== "GET";
    if (mutation && (request.headers.get("origin") !== publicUrl.origin || request.headers.get("sec-fetch-site") === "cross-site")) return error(403, "ORIGIN_NOT_ALLOWED");
    const name = `${publicUrl.protocol === "https:" ? "__Host-" : ""}bnm_customer_session`;
    const cookies = request.cookies.getAll(name);
    if (cookies.length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(cookies[0].value)) return error(401, "UNAUTHENTICATED");
    // Parse the raw header as well: cookie APIs may collapse duplicate names.
    if ((request.headers.get("cookie") ?? "").split(";").filter((part) => part.trim().split("=")[0] === name).length !== 1) return error(401, "UNAUTHENTICATED");
    const forwarded = new Headers({ cookie: `${name}=${cookies[0].value}` });
    let body: string | undefined;
    if (mutation) {
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return error(415, "UNSUPPORTED_MEDIA_TYPE");
      body = await boundedBody(request);
      if (body === undefined) return error(413, "PAYLOAD_TOO_LARGE");
      forwarded.set("content-type", "application/json");
      forwarded.set("origin", publicUrl.origin);
    }
    const response = await fetch(new URL(`/api/v1/customer-addresses${path.length ? `/${path.join("/")}` : ""}`, upstream), {
      method: request.method, headers: forwarded, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    });
    const data = await response.json();
    if (data?.version !== "v1" || (!Object.hasOwn(data, "data") && !Object.hasOwn(data, "error"))) return error(502, "UPSTREAM_UNAVAILABLE");
    const outputHeaders = new Headers(headers);
    forwardNumericRetryAfter(response, outputHeaders);
    return Response.json(data, { status: response.status, headers: outputHeaders });
  } catch { return error(502, "UPSTREAM_UNAVAILABLE"); }
}
