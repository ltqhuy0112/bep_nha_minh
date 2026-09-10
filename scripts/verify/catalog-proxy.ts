import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { NextRequest } from "next/server";

async function main() {
  let calls = 0;
  let lastTarget = "";
  const upstream = createServer((request, response) => {
    calls++;
    lastTarget = request.url ?? "";
    assert.equal(request.headers.cookie, undefined);
    assert.equal(request.headers.authorization, undefined);
    const notFound = lastTarget.includes("missing");
    response.writeHead(notFound ? 404 : 200, {
      "content-type": "application/json",
      "set-cookie": "must-not-forward=1",
      "x-internal-secret": "must-not-forward"
    });
    response.end(JSON.stringify(notFound
      ? { version: "v1", error: { code: "PRODUCT_NOT_FOUND", message: "Product not found." } }
      : { version: "v1", data: { items: [], page: 1, pageSize: 12, total: 0 } }));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  process.env.COMMERCE_API_URL = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  const { GET } = await import("../../apps/web/src/app/api/catalog/[...path]/route");
  async function proxy(path: string[], query: string) {
    return GET(new NextRequest(`http://localhost/api/catalog/${path.join("/")}?${query}`, {
      headers: { cookie: "private=1", authorization: "Bearer do-not-forward" }
    }), { params: Promise.resolve({ path }) });
  }
  try {
    const success = await proxy(["products"], "locale=vi");
    assert.equal(success.status, 200);
    assert.equal((await success.json()).version, "v1");
    assert.match(success.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(success.headers.get("set-cookie"), null);
    assert.equal(success.headers.get("x-internal-secret"), null);
    assert(lastTarget.startsWith("/api/v1/catalog/products?"));
    const missing = await proxy(["products", "missing"], "locale=en");
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, "PRODUCT_NOT_FOUND");
    for (const slug of ["rice_bowl", "cơm gà", "https://example.com", "percent%2Fvalue"]) {
      assert.equal((await proxy(["products", slug], "locale=vi")).status, 200);
      assert.equal(lastTarget, `/api/v1/catalog/products/${encodeURIComponent(slug)}?locale=vi`);
    }
    const before = calls;
    for (const params of [["admin"], ["products", ".."], ["products", "."], ["products", "a", "other"]]) {
      const rejected = await proxy(params, "locale=vi");
      assert.equal(rejected.status, 404);
      assert.equal((await rejected.json()).version, "v1");
    }
    for (const query of ["locale=fr", "locale=vi&locale=en", "locale=vi&pageSize=51", "locale=vi&unexpected=1"]) {
      const rejected = await proxy(["products"], query);
      assert.equal(rejected.status, 400);
      assert.equal((await rejected.json()).error.code, "VALIDATION_ERROR");
    }
    assert.equal(calls, before);
  } finally {
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
  const unavailable = await proxy(["products"], "locale=vi");
  assert.equal(unavailable.status, 502);
  const unavailableBody = await unavailable.json();
  assert.equal(unavailableBody.version, "v1");
  assert.equal(unavailableBody.error.code, "CATALOG_UPSTREAM_UNAVAILABLE");
  assert.match(unavailable.headers.get("cache-control") ?? "", /no-store/);
  console.log("Catalog BFF verification passed: allowlist, validation, v1 envelopes, credential isolation, no-store and unavailable upstream.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "BFF verification failed.");
  process.exitCode = 1;
});
