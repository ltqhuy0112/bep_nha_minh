import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { createApiServer } from "@bep-nha-minh/api/runtime/http-server";

async function main() {
  const readyServer = createApiServer({
    database: { query: async () => ({}) }
  });
  const baseUrl = await listen(readyServer);

  try {
    const live = await fetch(`${baseUrl}/api/v1/health/live`);
    assert.equal(live.status, 200);
    assert.deepEqual(await live.json(), { version: "v1", data: { status: "ok" } });

    const ready = await fetch(`${baseUrl}/api/v1/health/ready`);
    assert.equal(ready.status, 200);

    const missing = await fetch(`${baseUrl}/api/v1/missing`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, "NOT_FOUND");

    const wrongMethod = await fetch(`${baseUrl}/api/v1/health/live`, { method: "POST" });
    assert.equal(wrongMethod.status, 405);
    assert.equal(wrongMethod.headers.get("allow"), "GET");

    const openApi = await fetch(`${baseUrl}/api/v1/openapi.json`);
    assert.equal(openApi.status, 200);
    const document = await openApi.json();
    assert.equal(document.openapi, "3.1.0");
    for (const path of [
      "/api/v1/health/live",
      "/api/v1/health/ready",
      "/api/v1/openapi.json"
    ]) assert(path in document.paths);
  } finally {
    await close(readyServer);
  }

  const unavailableServer = createApiServer({
    database: { query: async () => Promise.reject(new Error("database unavailable")) }
  });
  const unavailableBaseUrl = await listen(unavailableServer);
  try {
    const ready = await fetch(`${unavailableBaseUrl}/api/v1/health/ready`);
    assert.equal(ready.status, 503);
    const body = await ready.json();
    assert.equal(body.error.code, "SERVICE_UNAVAILABLE");
    assert.equal(JSON.stringify(body).includes("database unavailable"), false);
  } finally {
    await close(unavailableServer);
  }

  const slowServer = createApiServer({
    database: { query: async () => new Promise(() => undefined) },
    readinessTimeoutMs: 10
  });
  const slowBaseUrl = await listen(slowServer);
  try {
    const ready = await fetch(`${slowBaseUrl}/api/v1/health/ready`);
    assert.equal(ready.status, 503);
  } finally {
    await close(slowServer);
  }

  await assertInvalidDatabaseUrlFails("%%%");
  await assertInvalidDatabaseUrlFails("https://localhost/bep_nha_minh");

  console.log("Phase 2 API foundation verification passed.");
}

async function listen(server: ReturnType<typeof createApiServer>): Promise<string> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: ReturnType<typeof createApiServer>) {
  const closed = once(server, "close");
  server.close();
  await closed;
}

async function assertInvalidDatabaseUrlFails(databaseUrl: string) {
  const child = spawn(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "apps/api/src/runtime/main.ts"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "production",
        DATABASE_URL: databaseUrl,
        API_PORT: "3313"
      },
      stdio: "ignore",
      windowsHide: true
    }
  );
  const exited = once(child, "exit");
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, 2_000);

  try {
    const [exitCode] = await exited;
    assert.equal(timedOut, false, "invalid DATABASE_URL startup must not hang");
    assert.notEqual(exitCode, 0, "invalid DATABASE_URL must fail startup");
  } finally {
    clearTimeout(timeout);
    if (child.exitCode === null) {
      child.kill();
      await Promise.race([
        exited,
        new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, 1_000))
      ]);
    }
  }
}

main().catch((error: unknown) => {
  console.error("Phase 2 API foundation verification failed.", error);
  process.exitCode = 1;
});
