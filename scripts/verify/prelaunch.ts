import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { NextRequest } from "next/server";
import { createApiServer } from "../../apps/api/src/runtime/http-server";

async function main() {
  delete process.env.NEXT_PUBLIC_ORDERING_ENABLED;
  const { orderingEnabled } = await import("../../apps/web/src/lib/ordering");
  assert.equal(orderingEnabled, false, "Missing flag must default to prelaunch");
  const { GET, POST } = await import("../../apps/web/src/app/api/cart/route");
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Prelaunch BFF must not call upstream"); };
  try {
    for (const method of ["GET", "POST"] as const) {
      const response = await ({ GET, POST }[method])(new NextRequest("http://localhost:3000/api/cart?locale=vi", { method }));
      assert.equal(response.status, 503);
      assert.equal((await response.json()).error.code, "ORDERING_NOT_ENABLED");
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  } finally { globalThis.fetch = original; }
  let mutations = 0;
  const server = createApiServer({ orderingEnabled: false, cartHandler: async (_request, response) => {
    mutations++; response.end("unexpected"); return true;
  } });
  try {
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    const port = (server.address() as AddressInfo).port;
    for (const method of ["GET", "POST"]) {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/cart`, { method });
      assert.equal(response.status, 503);
    }
    assert.equal(mutations, 0);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
  console.log("PASS: prelaunch default, BFF no upstream calls, API no cart mutations");
}
void main().catch((error: unknown) => { console.error(error instanceof assert.AssertionError ? error.message : "Prelaunch verification failed"); process.exitCode = 1; });
