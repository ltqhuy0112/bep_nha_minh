import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET, POST, PUT, DELETE } from "../../apps/web/src/app/api/customer-addresses/[[...path]]/route";

const originalFetch = globalThis.fetch;
const token = "a".repeat(43), id = "11111111-1111-4111-8111-111111111111";
let calls = 0, broken = false, status = 200;
process.env.PUBLIC_WEB_URL = "http://localhost:3000";
process.env.COMMERCE_API_URL = "http://127.0.0.1:3999";
async function request(method: "GET" | "POST" | "PUT" | "DELETE", path: string[], expected: number, override: Record<string, string> = {}, body = "{}", query = "") {
  const input = new NextRequest(`http://localhost:3000/api/customer-addresses${path.length ? `/${path.join("/")}` : ""}${query}`, {
    method, headers: { origin: "http://localhost:3000", "content-type": "application/json", cookie: `bnm_customer_session=${token}; authjs.session-token=admin`, authorization: "Bearer ignored", "x-forwarded-for": "spoofed", ...override },
    body: method === "GET" ? undefined : body,
  });
  const response = await ({ GET, POST, PUT, DELETE }[method])(input, { params: Promise.resolve({ path }) });
  assert.equal(response.status, expected);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("x-internal"), null);
  return response;
}
async function main() {
  globalThis.fetch = async (url, init) => {
    calls++;
    assert(String(url).startsWith("http://127.0.0.1:3999/api/v1/customer-addresses"));
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("cookie"), `bnm_customer_session=${token}`);
    assert.equal(headers.get("authorization"), null);
    assert.equal(headers.get("x-forwarded-for"), null);
    assert.equal(init?.redirect, "error");
    assert(init?.signal);
    if (init?.method !== "GET") assert.equal(headers.get("origin"), "http://localhost:3000");
    return Response.json(broken ? {} : { version: "v1", data: { items: [] } }, { status, headers: { "set-cookie": "admin=not-forwarded", "x-internal": "private", "retry-after": "60" } });
  };
  await request("GET", [], 200);
  await request("POST", [], 200);
  await request("PUT", [id], 200);
  await request("PUT", [id, "default"], 200);
  await request("DELETE", [id], 200);
  const before = calls;
  await request("GET", [], 401, { cookie: "authjs.session-token=admin" });
  await request("GET", [], 401, { cookie: `bnm_customer_session=${token}; bnm_customer_session=${token}` });
  await request("POST", [], 403, { origin: "https://evil.invalid" });
  await request("PUT", [id], 403, { "sec-fetch-site": "cross-site" });
  await request("POST", [], 415, { "content-type": "text/plain" });
  await request("POST", [], 413, {}, "a".repeat(17000));
  await request("GET", [id, "other"], 400);
  await request("GET", [], 400, {}, "", "?customerId=other");
  await request("GET", [id], 405);
  assert.equal(calls, before, "Invalid requests must not reach the upstream");
  broken = true; await request("GET", [], 502); broken = false;
  status = 429; assert.equal((await request("GET", [], 429)).headers.get("retry-after"), "60");
  globalThis.fetch = async () => { throw new Error("Offline"); };
  await request("GET", [], 502);
  console.log("PASS: address proxy methods, cookie isolation, duplicate-cookie rejection, origin, payload limits, upstream errors and retry header");
}
void main().catch((error: unknown) => { console.error(error instanceof assert.AssertionError ? error.message : "FAIL: address proxy checks"); process.exitCode = 1; }).finally(() => { globalThis.fetch = originalFetch; });
