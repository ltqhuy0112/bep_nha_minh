import "server-only";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Context = { params: Promise<{ path: string[] }> };
type OAuthProvider = "google" | "facebook";
type OAuthRoute = { provider: OAuthProvider; operation: "start" | "callback"; locale?: "vi" | "en"; search: URLSearchParams };

const routes: Record<string, string> = {
  config: "GET", session: "GET", login: "POST", register: "POST", logout: "POST", "logout-all": "POST",
  "forgot-password": "POST", "reset-password": "POST", "verify-email": "POST", "resend-verification": "POST"
};
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const localeValues = new Set(["vi", "en"]);

export async function GET(request: NextRequest, context: Context) { return proxy(request, context); }
export async function POST(request: NextRequest, context: Context) { return proxy(request, context); }

async function proxy(request: NextRequest, context: Context) {
  const path = (await context.params).path;
  const oauth = resolveOAuthRoute(request, path);
  if (oauth) return proxyOAuth(request, oauth);
  if (isOAuthPath(path)) return error(400, "VALIDATION_ERROR");

  if (path.length !== 1 || !Object.hasOwn(routes, path[0])) return error(404, "NOT_FOUND");
  if (routes[path[0]] !== request.method) return error(405, "METHOD_NOT_ALLOWED");
  if (request.nextUrl.search) return error(400, "VALIDATION_ERROR");
  try {
    const publicUrl = readPublicUrl();
    const upstream = readUpstreamUrl();
    if (!publicUrl || !upstream) return error(503, "AUTH_NOT_CONFIGURED");
    if (request.method === "POST" && !isStrictPostOrigin(request, publicUrl)) return error(403, "ORIGIN_NOT_ALLOWED");
    const headers = customerHeaders(request, publicUrl);
    let body: string | undefined;
    if (request.method === "POST") {
      if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return error(415, "UNSUPPORTED_MEDIA_TYPE");
      body = await boundedBody(request);
      if (body === undefined) return error(413, "PAYLOAD_TOO_LARGE");
      headers.set("content-type", "application/json");
      headers.set("origin", publicUrl.origin);
    }
    const response = await fetch(new URL(`/api/v1/customer-auth/${path[0]}`, upstream), {
      method: request.method, headers, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000)
    });
    const data = await response.json();
    if (data?.version !== "v1" || (!Object.hasOwn(data, "data") && !Object.hasOwn(data, "error"))) return error(502, "AUTH_UPSTREAM_UNAVAILABLE");
    const resultHeaders = responseHeaders(response, allowedCookieNames(publicUrl));
    const retry = response.headers.get("retry-after");
    if (retry && /^\d+$/.test(retry)) resultHeaders.set("retry-after", retry);
    return Response.json(data, { status: response.status, headers: resultHeaders });
  } catch { return error(502, "AUTH_UPSTREAM_UNAVAILABLE"); }
}

async function proxyOAuth(request: NextRequest, oauth: OAuthRoute) {
  if (request.method !== "GET") return error(405, "METHOD_NOT_ALLOWED");
  try {
    const publicUrl = readPublicUrl();
    const upstream = readUpstreamUrl();
    if (!publicUrl || !upstream) return error(503, "AUTH_NOT_CONFIGURED");
    if (oauth.operation === "start" && !isSameOriginRequest(request, publicUrl)) return error(403, "ORIGIN_NOT_ALLOWED");
    const headers = customerHeaders(request, publicUrl);
    if (oauth.operation === "start") headers.set("origin", publicUrl.origin);
    const target = new URL(`/api/v1/customer-auth/oauth/${oauth.provider}/${oauth.operation}`, upstream);
    target.search = oauth.search.toString();
    const response = await fetch(target, {
      method: "GET", headers, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(oauth.operation === "callback" ? 45_000 : 10_000)
    });
    const location = response.headers.get("location");
    const status = oauth.operation === "start" ? 302 : 303;
    if (response.status !== status || !location) return oauthErrorResponse(response, allowedCookieNames(publicUrl));
    if (!isAllowedOAuthLocation(location, oauth, publicUrl)) return error(502, "AUTH_UPSTREAM_UNAVAILABLE");
    const resultHeaders = responseHeaders(response, allowedCookieNames(publicUrl));
    resultHeaders.set("location", location);
    return new Response(null, { status, headers: resultHeaders });
  } catch { return error(502, "AUTH_UPSTREAM_UNAVAILABLE"); }
}

function resolveOAuthRoute(request: NextRequest, path: string[]): OAuthRoute | null {
  if (path.length !== 3 || path[0] !== "oauth" || !isProvider(path[1]) || (path[2] !== "start" && path[2] !== "callback")) return null;
  if (request.nextUrl.search.length > 16_384) return null;
  const search = request.nextUrl.searchParams;
  if (path[2] === "start") {
    const locale = search.get("locale");
    if (locale !== null && !isLocale(locale)) return null;
    if (!hasOnly(search, ["locale"])) return null;
    return { provider: path[1], operation: "start", locale: locale ?? "vi", search: new URLSearchParams({ locale: locale ?? "vi" }) };
  }
  const state = search.get("state");
  const code = search.get("code");
  const providerError = search.get("error");
  const providerFields = path[1] === "google" ? ["scope", "authuser", "prompt", "iss"] : ["error_reason", "error_description"];
  if (!state || !tokenPattern.test(state) || !hasOnly(search, ["state", "code", "error", ...providerFields])) return null;
  if ((code === null) === (providerError === null) || (code !== null && (code.length === 0 || code.length > 4_096)) || (providerError !== null && (providerError.length === 0 || providerError.length > 128))) return null;
  const safeSearch = new URLSearchParams({ state });
  if (code !== null) safeSearch.set("code", code); else safeSearch.set("error", providerError!);
  return { provider: path[1], operation: "callback", search: safeSearch };
}

function isOAuthPath(path: string[]) {
  return path.length === 3 && path[0] === "oauth" && isProvider(path[1]) && (path[2] === "start" || path[2] === "callback");
}

function isProvider(value: string): value is OAuthProvider { return value === "google" || value === "facebook"; }
function isLocale(value: string | null): value is "vi" | "en" { return value !== null && localeValues.has(value); }

function hasOnly(search: URLSearchParams, allowed: string[]) {
  const keys = [...search.keys()];
  return keys.every((key) => allowed.includes(key)) && new Set(keys).size === keys.length;
}

function readPublicUrl() {
  try {
    const value = new URL(process.env.PUBLIC_WEB_URL ?? "http://localhost:3000");
    return value.pathname === "/" && !value.search && !value.hash && !value.username && !value.password && ["https:", "http:"].includes(value.protocol) ? value : null;
  } catch { return null; }
}

function readUpstreamUrl() {
  try {
    const value = new URL(process.env.COMMERCE_API_URL ?? "http://127.0.0.1:3001");
    return ["http:", "https:"].includes(value.protocol) && !value.username && !value.password ? value : null;
  } catch { return null; }
}

function isSameOriginRequest(request: NextRequest, publicUrl: URL) {
  const origin = request.headers.get("origin");
  return request.headers.get("sec-fetch-site") !== "cross-site" && (!origin || origin === publicUrl.origin);
}

function isStrictPostOrigin(request: NextRequest, publicUrl: URL) {
  return request.headers.get("origin") === publicUrl.origin && request.headers.get("sec-fetch-site") !== "cross-site";
}

function allowedCookieNames(publicUrl: URL) {
  const prefix = publicUrl.protocol === "https:" ? "__Host-" : "";
  return new Set([`${prefix}bnm_customer_session`, `${prefix}bnm_customer_oauth_google`, `${prefix}bnm_customer_oauth_facebook`]);
}

function customerHeaders(request: NextRequest, publicUrl: URL) {
  const allowed = allowedCookieNames(publicUrl);
  const selected: string[] = [];
  const seen = new Set<string>();
  let duplicate = false;
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    const value = valueParts.join("=");
    if (!allowed.has(name)) continue;
    if (seen.has(name)) { duplicate = true; continue; }
    seen.add(name);
    if (tokenPattern.test(value)) selected.push(`${name}=${value}`);
  }
  const headers = new Headers();
  if (!duplicate && selected.length) headers.set("cookie", selected.join("; "));
  return headers;
}

function responseHeaders(response: Response, allowedCookies: Set<string>) {
  const headers = new Headers({ "cache-control": "no-store", "referrer-policy": "no-referrer" });
  for (const cookie of response.headers.getSetCookie()) {
    const name = cookie.slice(0, cookie.indexOf("="));
    if (allowedCookies.has(name) && isAllowedSetCookie(cookie, name)) headers.append("set-cookie", cookie);
  }
  return headers;
}

function isAllowedSetCookie(cookie: string, name: string) {
  if (/;\s*domain=/i.test(cookie) || !/;\s*path=\/(?:;|$)/i.test(cookie) || !/;\s*httponly(?:;|$)/i.test(cookie) || !/;\s*samesite=lax(?:;|$)/i.test(cookie)) return false;
  if (name.startsWith("__Host-") && !/;\s*secure(?:;|$)/i.test(cookie)) return false;
  const value = cookie.slice(name.length + 1, cookie.indexOf(";"));
  if (value === "") return /;\s*max-age=0(?:;|$)/i.test(cookie);
  if (!tokenPattern.test(value)) return false;
  return !name.includes("_oauth_") || /;\s*max-age=600(?:;|$)/i.test(cookie);
}

function isAllowedOAuthLocation(location: string, oauth: OAuthRoute, publicUrl: URL) {
  let target: URL;
  try { target = new URL(location); } catch { return false; }
  if (target.username || target.password || target.hash) return false;
  if (oauth.operation === "start") {
    if (oauth.provider === "google") return target.origin === "https://accounts.google.com" && target.pathname === "/o/oauth2/v2/auth";
    return target.origin === "https://www.facebook.com" && /^\/v\d+\.\d+\/dialog\/oauth$/.test(target.pathname);
  }
  if (target.origin !== publicUrl.origin || !["/vi/account", "/en/account"].includes(target.pathname) || target.hash) return false;
  return !target.search || target.search === "?oauth=error";
}

async function oauthErrorResponse(response: Response, allowedCookies: Set<string>) {
  try {
    const data = await response.json();
    if (data?.version !== "v1" || (!Object.hasOwn(data, "data") && !Object.hasOwn(data, "error"))) return error(502, "AUTH_UPSTREAM_UNAVAILABLE");
    const headers = responseHeaders(response, allowedCookies);
    const retry = response.headers.get("retry-after");
    if (retry && /^\d+$/.test(retry)) headers.set("retry-after", retry);
    return Response.json(data, { status: response.status, headers });
  } catch { return error(502, "AUTH_UPSTREAM_UNAVAILABLE"); }
}

async function boundedBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) return "{}";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16_384) { await reader.cancel(); return undefined; }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally { reader.releaseLock(); }
}

function error(status: number, code: string) {
  return Response.json({ version: "v1", error: { code, message: "Customer authentication request failed." } },
    { status, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}
