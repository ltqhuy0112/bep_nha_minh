import assert from "node:assert/strict";
import { CustomerAuthRequestError, loadInitialAuth } from "../../apps/web/src/features/customer-auth/service";

const originalFetch = globalThis.fetch;
const originalTimeout = AbortSignal.timeout;
const config = { enabled: true, emailEnabled: true, oauth: { google: true, facebook: false } };
let calls = 0;
let failConfig = false;
let sessionStatus = 401;

async function main() {
  globalThis.fetch = async (input) => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    const isConfig = String(input).endsWith("/config");
    const status = isConfig ? (failConfig ? 502 : 200) : sessionStatus;
    return Response.json(status === 200 ? { version: "v1", data: config } : { version: "v1", error: { code: "TEST_ERROR" } }, { status });
  };
  const first = loadInitialAuth();
  assert.equal(loadInitialAuth(), first, "Effect remount must share pending reads");
  assert.deepEqual(await first, { config, session: null });
  assert.equal(calls, 2, "One config and one session request");
  await loadInitialAuth();
  assert.equal(calls, 4, "Settled session must not be cached");

  failConfig = true;
  await assert.rejects(loadInitialAuth(), CustomerAuthRequestError);
  failConfig = false;
  assert.deepEqual(await loadInitialAuth(), { config, session: null }, "Retry recovers after config failure");
  sessionStatus = 503;
  await assert.rejects(loadInitialAuth(), (error: unknown) => error instanceof CustomerAuthRequestError && error.status === 503);

  AbortSignal.timeout = (milliseconds) => {
    assert.equal(milliseconds, 15_000);
    return originalTimeout(10);
  };
  globalThis.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
    init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason), { once: true });
  });
  // Keep the process alive while Node's unreferenced timeout signal fires.
  const keepAlive = setTimeout(() => {}, 1000);
  try { await assert.rejects(loadInitialAuth(), { name: "TimeoutError" }); }
  finally { clearTimeout(keepAlive); }
  console.log("PASS: in-flight dedupe, fresh session, config retry, session failure, timeout");
}

void main().finally(() => {
  globalThis.fetch = originalFetch;
  AbortSignal.timeout = originalTimeout;
}).catch(() => { console.error("FAIL: auth loading verification"); process.exitCode = 1; });
