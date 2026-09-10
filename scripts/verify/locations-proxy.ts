import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET } from "../../apps/web/src/app/api/locations/[...path]/route";

const originalFetch = globalThis.fetch;
process.env.COMMERCE_API_URL = "http://127.0.0.1:3999";
let calls = 0;
async function request(path: string[], expected: number, query = "") {
  const result = await GET(new NextRequest(`http://localhost:3000/api/locations/${path.join("/")}${query}`, {
    headers: { cookie: "private=session", authorization: "Bearer private" },
  }), { params: Promise.resolve({ path }) });
  assert.equal(result.status, expected);
  assert.equal(result.headers.get("cache-control"), expected === 200 ? "public, max-age=300" : "no-store");
  assert.equal(result.headers.get("set-cookie"), null);
}
async function main() {
  globalThis.fetch = async (url, init) => {
    calls++;
    assert(String(url).startsWith("http://127.0.0.1:3999/api/v1/locations/provinces"));
    assert.equal(new Headers(init?.headers).get("cookie"), null);
    assert.equal(new Headers(init?.headers).get("authorization"), null);
    assert.equal(init?.redirect, "error"); assert(init?.signal);
    return Response.json({ version: "v1", data: { datasetId: "test", items: [] } }, { headers: { "set-cookie": "private=upstream" } });
  };
  await request(["provinces"], 200); await request(["provinces", "01", "wards"], 200);
  await request(["provinces", "1", "wards"], 404);
  await request(["provinces"], 400, "?url=https://example.invalid");
  assert.equal(calls, 2);
  globalThis.fetch = async () => Response.json({ unexpected: true });
  await request(["provinces"], 502);
  globalThis.fetch = async () => { throw new Error("Offline"); };
  await request(["provinces"], 503);
  console.log("PASS: location BFF route allowlist, no credential forwarding, public cache and uncached failures");
}
void main().catch(() => { console.error("FAIL: location proxy verification"); process.exitCode = 1; }).finally(() => { globalThis.fetch = originalFetch; });
