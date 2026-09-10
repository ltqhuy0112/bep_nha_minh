import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET, POST } from "../../apps/web/src/app/api/cart/route";
import { safeReturnTo } from "../../apps/web/src/features/customer-auth/routes";

const originalFetch = globalThis.fetch;
const token = "a".repeat(43);
let calls = 0;
process.env.PUBLIC_WEB_URL = "http://localhost:3000";
process.env.COMMERCE_API_URL = "http://127.0.0.1:3999";

type RequestOptions = { query?: string; headers?: Record<string, string>; body?: string };

function request(method: "GET" | "POST", expected: number, options: RequestOptions = {}) {
  const query = options.query ?? (method === "GET" ? "?locale=vi" : "");
  const input = new NextRequest(`http://localhost:3000/api/cart${query}`, {
    method,
    headers: {
      origin: "http://localhost:3000", "content-type": "application/json",
      cookie: `bnm_customer_session=${token}; bnm_guest_cart=${token}; authjs.session-token=admin`,
      authorization: "Bearer must-not-forward", "x-forwarded-for": "spoofed", ...options.headers
    },
    body: method === "POST" ? options.body ?? "{\"action\":\"initialize\",\"locale\":\"vi\"}" : undefined
  });
  return (method === "GET" ? GET(input) : POST(input)).then((response) => {
    assert.equal(response.status, expected);
    return response;
  });
}

async function main() {
  assert.equal(safeReturnTo("/vi/cart", "vi"), "/vi/cart");
  assert.equal(safeReturnTo("/en/cart", "vi"), "/vi/account");
  assert.equal(safeReturnTo("//evil", "vi"), "/vi/account");
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), `http://127.0.0.1:3999/api/v1/cart${init?.method === "GET" ? "?locale=vi" : ""}`);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("cookie"), `bnm_customer_session=${token}; bnm_guest_cart=${token}`);
    assert.equal(headers.get("authorization"), null);
    assert.equal(headers.get("x-forwarded-for"), null);
    assert.equal(init?.redirect, "error");
    assert(init?.signal);
    const responseHeaders = new Headers({ "x-internal": "private", "set-cookie": `bnm_customer_session=${token}; Path=/; HttpOnly` });
    responseHeaders.append("set-cookie", `bnm_guest_cart=${token}; Domain=evil.invalid; Max-Age=3600`);
    responseHeaders.append("set-cookie", `bnm_guest_cart=${token}; Path=/`);
    return Response.json({ version: "v1", data: { items: [] } }, { headers: responseHeaders });
  };

  const get = await request("GET", 200);
  assert.equal(get.status, 200);
  assert.equal(get.headers.get("cache-control"), "no-store");
  assert.equal(get.headers.get("x-internal"), null);
  assert.equal(get.headers.get("set-cookie"), `bnm_guest_cart=${token}; Path=/; HttpOnly; SameSite=Lax`);
  await request("POST", 200);
  const before = calls;
  const rejected: RequestOptions[] = [
    { query: "?locale=fr" }, { query: "?locale=vi&locale=en" }, { query: "?locale=vi&admin=true" },
    { headers: { cookie: `bnm_guest_cart=${token}; bnm_guest_cart=${token}` } },
    { headers: { cookie: "bnm_guest_cart=invalid" } }, { headers: { origin: "https://evil.invalid" } },
    { headers: { "sec-fetch-site": "cross-site" } }, { headers: { "content-type": "text/plain" } },
    { body: "[1,2]" }, { body: "{" }, { body: "a".repeat(16_385) }
  ];
  for (const options of rejected) {
    const method = "body" in options || "origin" in (options.headers ?? {}) || "sec-fetch-site" in (options.headers ?? {}) || "content-type" in (options.headers ?? {}) ? "POST" : "GET";
    const expected = options.headers?.origin || options.headers?.["sec-fetch-site"] ? 403
      : options.headers?.["content-type"] === "text/plain" ? 415
        : options.body?.length && options.body.length > 16_384 ? 413
          : options.headers?.cookie ? 401 : 400;
    const response = await request(method, expected, options);
    if ("headers" in options && (options.headers?.origin || options.headers?.["sec-fetch-site"])) assert.equal(response.status, 403);
    else if (options.headers?.["content-type"] === "text/plain") assert.equal(response.status, 415);
    else if (options.body?.length && options.body.length > 16_384) assert.equal(response.status, 413);
    else if (options.headers?.cookie) assert.equal(response.status, 401);
    else assert.equal(response.status, 400);
  }
  assert.equal(calls, before, "Rejected requests must not reach the upstream");
  process.env.COMMERCE_API_URL = "http://127.0.0.1:3999/not-root";
  await request("GET", 503);
  assert.equal(calls, before, "Invalid upstream URLs must not reach fetch");
  process.env.COMMERCE_API_URL = "http://127.0.0.1:3999";
  globalThis.fetch = async () => Response.json({ version: "v1", data: {} }, {
    headers: { "set-cookie": "bnm_guest_cart=; Max-Age=0" }
  });
  const clearing = await request("GET", 200);
  assert.equal(clearing.headers.get("set-cookie"), "bnm_guest_cart=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  globalThis.fetch = async () => Response.json({ version: "v1", error: { code: "INVALID_CREDENTIAL" } }, {
    status: 401, headers: { "set-cookie": `bnm_guest_cart=${token}; Path=/` }
  });
  const failed = await request("GET", 401);
  assert.equal(failed.headers.get("set-cookie"), null, "Failed upstream responses must not set guest cookies");
  console.log("Cart BFF verification passed: locale/query validation, CSRF, bounded JSON, cookie isolation and allowlisted guest-cookie clearing.");
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Cart BFF verification failed.");
  process.exitCode = 1;
}).finally(() => { globalThis.fetch = originalFetch; });
