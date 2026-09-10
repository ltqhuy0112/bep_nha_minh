import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { NextRequest } from "next/server";
import nextConfig from "../../apps/web/next.config";

const token = "a".repeat(43);

async function main() {
  const logging = nextConfig.logging;
  assert(logging && typeof logging === "object" && typeof logging.incomingRequests === "object");
  assert(logging.incomingRequests.ignore?.some((pattern) => pattern.test("/api/customer-auth/oauth/google/callback?state=sensitive&code=sensitive")));
  assert(logging.incomingRequests.ignore?.some((pattern) => pattern.test("/api/customer-auth/oauth/facebook/callback?state=sensitive&code=sensitive")));
  assert(!logging.fetches?.fullUrl, "Full fetch-URL logging must not expose OAuth callback queries");
  let calls = 0;
  let lastTarget = "";
  let seenCookie: string | undefined;
  let seenOrigin: string | undefined;
  let maliciousJson = false;
  let maliciousRedirect = "";
  let maliciousCookie = false;
  const upstream = createServer((request, response) => {
    calls++;
    lastTarget = request.url ?? "";
    seenCookie = request.headers.cookie;
    seenOrigin = request.headers.origin;
    assert.equal(request.headers.authorization, undefined);
    assert.equal(request.headers["x-forwarded-for"], undefined);
    assert(request.url?.startsWith("/api/v1/customer-auth/"));
    const target = request.url ?? "";
    if (target.startsWith("/api/v1/customer-auth/oauth/")) {
      if (target.includes(`state=${"c".repeat(43)}`)) {
        response.writeHead(429, { "content-type": "application/json", "retry-after": "45" });
        response.end(JSON.stringify({ version: "v1", error: { code: "OAUTH_RATE_LIMITED", message: "Retry later." } }));
        return;
      }
      const callback = target.includes("/callback?");
      const google = target.includes("/google/");
      response.writeHead(callback ? 303 : 302, {
        location: maliciousRedirect || (callback ? "http://localhost:3000/vi/account" : google
          ? "https://accounts.google.com/o/oauth2/v2/auth?state=provider" : "https://www.facebook.com/v20.0/dialog/oauth?state=provider"),
        "set-cookie": [`bnm_customer_oauth_${google ? "google" : "facebook"}=${token}; Path=${maliciousCookie ? "/evil" : "/"}; HttpOnly; SameSite=Lax; Max-Age=600`, "admin=blocked; Domain=localhost; Path=/"],
        "x-internal": "private"
      });
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": "application/json", "x-internal": "private",
      "set-cookie": [`bnm_customer_session=${token}; Path=/; HttpOnly; SameSite=Lax`, "authjs.session-token=do-not-forward; Path=/"],
      "retry-after": "60" });
    response.end(JSON.stringify(maliciousJson ? { unexpected: true } : { version: "v1", data: { accepted: true } }));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  process.env.COMMERCE_API_URL = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  process.env.PUBLIC_WEB_URL = "http://localhost:3000";
  const { GET, POST } = await import("../../apps/web/src/app/api/customer-auth/[...path]/route");
  async function request(path: string[], method = "POST", overrides: Record<string, string> = {}, body = "", query = "") {
    const input = new NextRequest(`http://localhost:3000/api/customer-auth/${path.join("/")}${query}`, {
      method, headers: { origin: "http://localhost:3000", "content-type": "application/json", authorization: "Bearer admin",
        "x-forwarded-for": "spoofed", cookie: `authjs.session-token=admin; bnm_customer_session=${token}; bnm_customer_oauth_google=${token}`, ...overrides },
      body: method === "POST" ? body || "{}" : undefined
    });
    return (method === "POST" ? POST : GET)(input, { params: Promise.resolve({ path }) });
  }
  try {
    const login = await request(["login"]);
    assert.equal(login.status, 200);
    assert.equal(seenCookie, `bnm_customer_session=${token}; bnm_customer_oauth_google=${token}`);
    assert.equal(seenOrigin, "http://localhost:3000");
    assert.equal(login.headers.getSetCookie().length, 1);
    assert(!login.headers.get("set-cookie")!.includes("authjs"));
    assert.equal(login.headers.get("x-internal"), null);
    assert.equal(login.headers.get("cache-control"), "no-store");
    const before = calls;
    assert.equal((await request(["login"], "POST", { origin: "https://evil.example" })).status, 403);
    assert.equal((await request(["login"], "POST", { "sec-fetch-site": "cross-site" })).status, 403);
    assert.equal((await request(["login"], "POST", { "content-type": "text/plain" })).status, 415);
    assert.equal((await request(["login"], "POST", {}, "a".repeat(17_000))).status, 413);
    assert.equal((await request(["login"], "GET")).status, 405);
    assert.equal((await request(["admin", "orders"])).status, 404);
    assert.equal((await request(["login"], "POST", {}, "{}", "?token=secret")).status, 400);
    assert.equal(calls, before);
    await request(["session"], "GET", { cookie: "authjs.session-token=admin" });
    assert.equal(seenCookie, undefined);
    await request(["session"], "GET", { cookie: `bnm_customer_session=${token}; bnm_customer_session=${token}` });
    assert.equal(seenCookie, undefined);

    const start = await request(["oauth", "google", "start"], "GET", {}, "", "?locale=vi");
    assert.equal(start.status, 302);
    assert.match(start.headers.get("location") ?? "", /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/);
    assert.equal(start.headers.getSetCookie().length, 1);
    assert.equal(seenOrigin, "http://localhost:3000");
    assert.equal(seenCookie, `bnm_customer_session=${token}; bnm_customer_oauth_google=${token}`);
    const state = "b".repeat(43);
    const callback = await request(["oauth", "google", "callback"], "GET", { "sec-fetch-site": "cross-site", origin: "https://accounts.google.com" }, "", `?state=${state}&code=code-value&scope=openid&authuser=0&prompt=none&iss=https%3A%2F%2Faccounts.google.com`);
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get("location"), "http://localhost:3000/vi/account");
    assert.equal(seenOrigin, undefined);
    assert.match(seenCookie ?? "", /bnm_customer_oauth_google=/);
    const facebook = await request(["oauth", "facebook", "start"], "GET", {}, "", "?locale=en");
    assert.equal(facebook.status, 302);
    assert.match(facebook.headers.get("location") ?? "", /^https:\/\/www\.facebook\.com\/v20\.0\/dialog\/oauth/);
    const facebookError = await request(["oauth", "facebook", "callback"], "GET", { "sec-fetch-site": "cross-site", origin: "https://www.facebook.com" }, "", `?state=${state}&error=access_denied&error_reason=user_denied&error_description=declined`);
    assert.equal(facebookError.status, 303);
    assert.match(lastTarget, /error=access_denied/);
    assert(!lastTarget.includes("error_reason") && !lastTarget.includes("error_description"));
    assert.equal((await request(["oauth", "google", "start"], "GET")).status, 302);
    const beforeOAuthRejects = calls;
    for (const query of ["?locale=fr", "?locale=vi&locale=en", "?locale=vi&x=1"]) assert.equal((await request(["oauth", "google", "start"], "GET", {}, "", query)).status, 400);
    for (const query of [`?state=${state}`, `?state=${state}&code=x&error=access_denied`, `?state=${state}&code=x&code=y`, `?state=bad&code=x`, `?state=${state}&error=${"a".repeat(129)}`, `?state=${state}&code=x&unexpected=1`, `?locale=vi&state=${state}&code=x`]) {
      assert.equal((await request(["oauth", "google", "callback"], "GET", {}, "", query)).status, 400);
    }
    assert.equal((await request(["oauth", "google", "start"], "GET", { origin: "https://evil.example" }, "", "?locale=vi")).status, 403);
    assert.equal((await request(["oauth", "google", "start"], "GET", { "sec-fetch-site": "cross-site" }, "", "?locale=vi")).status, 403);
    assert.equal(calls, beforeOAuthRejects);
    const missingPostOrigin = new NextRequest("http://localhost:3000/api/customer-auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal((await POST(missingPostOrigin, { params: Promise.resolve({ path: ["login"] }) })).status, 403);
    const backendError = await request(["oauth", "google", "callback"], "GET", {}, "", `?state=${"c".repeat(43)}&code=code-value`);
    assert.equal(backendError.status, 429);
    assert.equal(backendError.headers.get("retry-after"), "45");
    maliciousRedirect = "https://evil.example/steal";
    assert.equal((await request(["oauth", "google", "start"], "GET", {}, "", "?locale=vi")).status, 502);
    assert.equal((await request(["oauth", "google", "callback"], "GET", {}, "", `?state=${state}&code=code-value`)).status, 502);
    for (const location of ["https://user:pass@accounts.google.com/o/oauth2/v2/auth", "https://accounts.google.com/o/oauth2/v2/auth#unexpected"]) {
      maliciousRedirect = location;
      assert.equal((await request(["oauth", "google", "start"], "GET")).status, 502);
    }
    maliciousRedirect = "";
    maliciousCookie = true;
    const rejectedCookie = await request(["oauth", "google", "start"], "GET", {}, "", "?locale=vi");
    assert.equal(rejectedCookie.status, 302);
    assert.equal(rejectedCookie.headers.getSetCookie().length, 0);
    maliciousCookie = false;
    maliciousJson = true;
    assert.equal((await request(["config"], "GET")).status, 502);
  } finally { await new Promise<void>((resolve) => upstream.close(() => resolve())); }
  assert.equal((await request(["config"], "GET")).status, 502);
  console.log("Customer auth BFF verification passed: JSON isolation, OAuth allowlists, callback binding transport, redirect validation, CSRF and upstream failures.");
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "BFF verification failed."); process.exitCode = 1; });
