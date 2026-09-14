import assert from "node:assert/strict";
import { test } from "node:test";
import { boundedBody } from "../../apps/web/src/lib/bff/request-body";
import { isHttpOrigin, forwardNumericRetryAfter, privateResponseHeaders } from "../../apps/web/src/lib/bff/http";

test("HTTP origin validation preserves strict root-only policy", () => {
  for (const value of ["http://localhost:3000", "https://example.com/", "http://[::1]:3001"]) {
    assert.equal(isHttpOrigin(new URL(value)), true);
  }
  for (const value of ["ftp://example.com", "https://user:pass@example.com", "https://example.com/path", "https://example.com/?x=1", "https://example.com/#x"]) {
    assert.equal(isHttpOrigin(new URL(value)), false);
  }
});

test("Retry-After only forwards digits and never copies cookies or private headers", () => {
  for (const value of ["0", "30", "001", "-1", "1.5", "Wed, 21 Oct 2015 07:28:00 GMT", ""]) {
    const response = new Response(null, { headers: { "retry-after": value, "set-cookie": "private=secret", "x-internal": "private" } });
    const headers = new Headers(privateResponseHeaders);
    forwardNumericRetryAfter(response, headers);
    assert.equal(headers.get("retry-after"), /^\d+$/.test(value) ? value : null);
    assert.equal(headers.get("set-cookie"), null);
    assert.equal(headers.get("x-internal"), null);
    assert.equal(headers.get("cache-control"), "no-store");
  }
});

test("body reader preserves missing versus empty body and UTF-8 chunk boundaries", async () => {
  assert.equal(await boundedBody({ body: null }), "{}");
  assert.equal(await boundedBody({ body: new ReadableStream({ start(controller) { controller.close(); } }) }), "");
  const bytes = new TextEncoder().encode("Bếp Nhà Mình");
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>({ start(controller) {
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  } });
  assert.equal(await boundedBody({ body }), "Bếp Nhà Mình");
  assert.equal(body.locked, false);
});

test("body limit is byte-based, accepts exactly 16 KiB and cancels overflow", async () => {
  for (const size of [16384, 16385]) {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array<ArrayBuffer>>({ start(controller) {
      controller.enqueue(new Uint8Array(size));
      if (size === 16384) controller.close();
    }, cancel() { cancelled = true; } });
    const result = await boundedBody({ body });
    assert.equal(result?.length, size === 16384 ? size : undefined);
    assert.equal(cancelled, size > 16384);
    assert.equal(body.locked, false);
  }
});

test("body reader releases lock on read failure", async () => {
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>({ start(controller) { controller.error(new Error("read failed")); } });
  await assert.rejects(boundedBody({ body }), /read failed/);
  assert.equal(body.locked, false);
});

test("body reader cancels stalled requests at existing five-second deadline", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>({ cancel() { cancelled = true; } });
  await assert.rejects(boundedBody({ body }), /Body timeout/);
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
});
