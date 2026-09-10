import "server-only";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const TIMEOUT_MS = 8_000;
const localeValues = new Set(["vi", "en"]);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
type RouteContext = { params: Promise<{ path: string[] }> };
type ResolvedRoute = { pathname: string; search: URLSearchParams };
type RouteResolution = { route: ResolvedRoute } | { error: "bad-request" | "not-found" };

export async function GET(request: NextRequest, context: RouteContext) {
  const resolution = resolveRoute(request.nextUrl.searchParams, (await context.params).path);
  if ("error" in resolution) {
    return v1Error(resolution.error === "bad-request" ? 400 : 404, resolution.error === "bad-request" ? "VALIDATION_ERROR" : "NOT_FOUND", resolution.error === "bad-request" ? "Invalid catalog request." : "Route not found.");
  }

  try {
    const upstreamUrl = createUpstreamUrl(resolution.route);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const upstream = await fetch(upstreamUrl, {
        cache: "no-store",
        signal: controller.signal,
        redirect: "error"
      });
      return new Response(await upstream.arrayBuffer(), {
        status: upstream.status,
        headers: jsonHeaders()
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return v1Error(502, "CATALOG_UPSTREAM_UNAVAILABLE", "Catalog service is unavailable.");
  }
}

function resolveRoute(search: URLSearchParams, path: string[]): RouteResolution {
  if (path.length === 1 && path[0] === "products") {
    const locale = readLocale(search);
    const page = readPositiveInteger(search.get("page"), 1, 10_000);
    const pageSize = readPositiveInteger(search.get("pageSize"), 12, 50);
    if (!locale || page === null || pageSize === null || !hasOnly(search, ["locale", "page", "pageSize"])) {
      return { error: "bad-request" };
    }
    return { route: { pathname: "products", search: new URLSearchParams({ locale, page: String(page), pageSize: String(pageSize) }) } };
  }

  if (path.length === 1 && path[0] === "fulfillment-slots") {
    const date = search.get("date");
    if (!date || !datePattern.test(date) || !hasOnly(search, ["date"])) {
      return { error: "bad-request" };
    }
    return { route: { pathname: "fulfillment-slots", search: new URLSearchParams({ date }) } };
  }

  if (path.length === 2 && path[0] === "products" && isSlug(path[1])) {
    const locale = readLocale(search);
    if (!locale || !hasOnly(search, ["locale"])) {
      return { error: "bad-request" };
    }
    return { route: { pathname: `products/${encodeURIComponent(path[1])}`, search: new URLSearchParams({ locale }) } };
  }

  if (path.length === 3 && path[0] === "products" && path[2] === "availability" && isSlug(path[1])) {
    const locale = readLocale(search);
    const date = search.get("date");
    const slotKey = search.get("slotKey");
    if (!locale || !date || !datePattern.test(date) || !slotKey || !slotKey.trim() || !hasOnly(search, ["locale", "date", "slotKey"])) {
      return { error: "bad-request" };
    }
    return { route: { pathname: `products/${encodeURIComponent(path[1])}/availability`, search: new URLSearchParams({ locale, date, slotKey }) } };
  }

  return { error: "not-found" };
}

function createUpstreamUrl(route: ResolvedRoute) {
  const base = new URL(process.env.COMMERCE_API_URL || "http://127.0.0.1:3001");
  if ((base.protocol !== "http:" && base.protocol !== "https:") || base.username || base.password) {
    throw new Error("Invalid COMMERCE_API_URL.");
  }
  const upstreamUrl = new URL(`/api/v1/catalog/${route.pathname}`, base);
  upstreamUrl.search = route.search.toString();
  return upstreamUrl;
}

function isSlug(value: string) {
  return value.trim().length > 0 && value !== "." && value !== "..";
}

function readLocale(search: URLSearchParams) {
  const locale = search.get("locale");
  return locale && localeValues.has(locale) ? locale : null;
}

function readPositiveInteger(value: string | null, fallback: number, maximum: number) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= 1 && parsed <= maximum ? parsed : null;
}

function hasOnly(search: URLSearchParams, allowed: string[]) {
  return [...search.keys()].every((key) => allowed.includes(key)) && [...new Set(search.keys())].length === [...search.keys()].length;
}

function v1Error(status: number, code: string, message: string) {
  return Response.json({ version: "v1", error: { code, message } }, { status, headers: jsonHeaders() });
}

function jsonHeaders() {
  return { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
}
