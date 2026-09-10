import "server-only";
import type { NextRequest } from "next/server";
import { cartCommandSchema } from "@bep-nha-minh/shared/schemas/cart";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const localeSchema = z.enum(["vi", "en"]);
const responseSchema = z.object({ version: z.literal("v1") }).passthrough().refine(
  (value) => Object.hasOwn(value, "data") || Object.hasOwn(value, "error")
);
const commonHeaders = { "cache-control": "no-store", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff" };

export const GET = proxy;
export const POST = proxy;

async function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "POST") return methodNotAllowed();
  const locale = readLocale(request);
  if (request.method === "GET" && !locale) return error(400, "VALIDATION_ERROR");
  if (request.method === "POST" && request.nextUrl.search) return error(400, "VALIDATION_ERROR");

  try {
    const publicUrl = readPublicUrl();
    const upstream = readUpstreamUrl();
    if (!publicUrl || !upstream) return error(503, "CART_NOT_CONFIGURED");
    if (request.method === "POST" && !isStrictPostOrigin(request, publicUrl)) return error(403, "ORIGIN_NOT_ALLOWED");

    const cookies = customerCookies(request, publicUrl);
    if (!cookies) return error(401, "INVALID_CREDENTIAL");
    let body: string | undefined;
    if (request.method === "POST") {
      if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
        return error(415, "UNSUPPORTED_MEDIA_TYPE");
      }
      body = await boundedBody(request);
      if (body === undefined) return error(413, "PAYLOAD_TOO_LARGE");
      if (!isValidJsonBody(body)) return error(400, "VALIDATION_ERROR");
      cookies.set("content-type", "application/json");
      cookies.set("origin", publicUrl.origin);
    }

    const target = new URL("/api/v1/cart", upstream);
    if (locale) target.searchParams.set("locale", locale);
    const upstreamResponse = await fetch(target, {
      method: request.method, headers: cookies, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000)
    });
    const data: unknown = await upstreamResponse.json();
    if (!responseSchema.safeParse(data).success) return error(502, "CART_UPSTREAM_UNAVAILABLE");

    const outputHeaders = responseHeaders(upstreamResponse, guestCookieName(publicUrl));
    const retry = upstreamResponse.headers.get("retry-after");
    if (retry && /^\d+$/.test(retry)) outputHeaders.set("retry-after", retry);
    return Response.json(data, { status: upstreamResponse.status, headers: outputHeaders });
  } catch {
    return error(502, "CART_UPSTREAM_UNAVAILABLE");
  }
}

function readLocale(request: NextRequest) {
  const entries = [...request.nextUrl.searchParams.entries()];
  if (entries.length !== 1 || entries[0][0] !== "locale") return null;
  const parsed = localeSchema.safeParse(entries[0][1]);
  return parsed.success ? parsed.data : null;
}

function readPublicUrl() {
  try {
    const value = new URL(process.env.PUBLIC_WEB_URL ?? "http://localhost:3000");
    return value.pathname === "/" && !value.search && !value.hash && !value.username && !value.password && ["http:", "https:"].includes(value.protocol) ? value : null;
  } catch { return null; }
}

function readUpstreamUrl() {
  try {
    const value = new URL(process.env.COMMERCE_API_URL ?? "http://127.0.0.1:3001");
    return value.pathname === "/" && !value.search && !value.hash && !value.username && !value.password && ["http:", "https:"].includes(value.protocol) ? value : null;
  } catch { return null; }
}

function isStrictPostOrigin(request: NextRequest, publicUrl: URL) {
  return request.headers.get("origin") === publicUrl.origin && request.headers.get("sec-fetch-site") !== "cross-site";
}

function customerCookies(request: NextRequest, publicUrl: URL) {
  const allowed = new Set([sessionCookieName(publicUrl), guestCookieName(publicUrl)]);
  const selected: string[] = [];
  const seen = new Set<string>();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (!allowed.has(name)) continue;
    const value = valueParts.join("=");
    if (seen.has(name) || !tokenPattern.test(value)) return null;
    seen.add(name);
    selected.push(`${name}=${value}`);
  }
  return new Headers(selected.length ? { cookie: selected.join("; ") } : undefined);
}

function sessionCookieName(publicUrl: URL) { return `${publicUrl.protocol === "https:" ? "__Host-" : ""}bnm_customer_session`; }
function guestCookieName(publicUrl: URL) { return `${publicUrl.protocol === "https:" ? "__Host-" : ""}bnm_guest_cart`; }

function responseHeaders(response: Response, guestName: string) {
  const headers = new Headers(commonHeaders);
  if (!response.ok) return headers;
  for (const cookie of response.headers.getSetCookie()) {
    const safeCookie = safeGuestCookie(cookie, guestName);
    if (safeCookie) headers.append("set-cookie", safeCookie);
  }
  return headers;
}

function safeGuestCookie(cookie: string, guestName: string) {
  const [first, ...attributes] = cookie.split(";").map((part) => part.trim());
  const equals = first.indexOf("=");
  if (equals < 1 || first.slice(0, equals) !== guestName) return null;
  const value = first.slice(equals + 1);
  const maxAge = attributes.filter((attribute) => /^max-age=/i.test(attribute));
  if (maxAge.length > 1 || (maxAge.length === 1 && !/^max-age=0$/i.test(maxAge[0]))) return null;
  const deleting = maxAge.length === 1;
  if ((!deleting && !tokenPattern.test(value)) || (deleting && value !== "")) return null;
  return `${guestName}=${value}; Path=/; HttpOnly; SameSite=Lax${guestName.startsWith("__Host-") ? "; Secure" : ""}${deleting ? "; Max-Age=0" : ""}`;
}

function isValidJsonBody(body: string) {
  try { return cartCommandSchema.safeParse(JSON.parse(body)).success; } catch { return false; }
}

async function boundedBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) return "{}";
  let expired = false;
  const timer = setTimeout(() => { expired = true; void reader.cancel().catch(() => undefined); }, 5_000);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (expired) throw new Error("Body timeout");
      if (done) return Buffer.concat(chunks).toString("utf8");
      size += value.length;
      if (size > 16_384) { await reader.cancel(); return undefined; }
      chunks.push(value);
    }
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

function methodNotAllowed() {
  const response = error(405, "METHOD_NOT_ALLOWED");
  response.headers.set("Allow", "GET, POST");
  return response;
}

function error(status: number, code: string) {
  return Response.json({ version: "v1", error: { code, message: "Cart request failed." } }, { status, headers: commonHeaders });
}
