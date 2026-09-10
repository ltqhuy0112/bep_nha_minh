import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket, type AddressInfo } from "node:net";
import path from "node:path";
import pg from "pg";
import { runner } from "node-pg-migrate";
import { createApiServer } from "../../apps/api/src/runtime/http-server";
import { createCustomerAuthHandler } from "../../apps/api/src/features/customer-auth/http";
import { readCustomerAuthConfig, type CustomerAuthConfig } from "../../apps/api/src/features/customer-auth/config";
import { dispatchAuthEmails, type EmailProvider } from "../../apps/api/src/features/customer-auth/email";
import { newToken, sessionCookie, tokenHash, verifyPassword } from "../../apps/api/src/features/customer-auth/security";

const base = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh");
const name = `bep_auth_test_${randomUUID().replaceAll("-", "")}`;
const url = new URL(base);
url.pathname = `/${name}`;
const admin = new pg.Client({ connectionString: base.toString() });
const pool = new pg.Pool({ connectionString: url.toString(), max: 6 });
const config: CustomerAuthConfig = { enabled: true, publicWebUrl: "http://localhost:3000", secureCookies: false,
  email: { encryptionKey: randomBytes(32).toString("base64"), publicWebUrl: "http://localhost:3000" },
  rateLimit: { key: randomBytes(32).toString("base64"), limit: 100, windowSeconds: 1 } };
const server = createApiServer({ customerAuthHandler: createCustomerAuthHandler(pool, config) });
let origin = "";
let created = false;
let checks = 0;
const password = "Test-only-password-123!";
const delivery: { text: string }[] = [];
const provider: EmailProvider = { async send(message) { delivery.push(message); } };
const policy = { batchSize: 10, maxAttempts: 3, baseDelaySeconds: 1, maxDelaySeconds: 10, leaseSeconds: 30 };

async function request(action: string, expected: number, body?: object, cookie?: string, requestOrigin = config.publicWebUrl) {
  const response = await fetch(`${origin}/api/v1/customer-auth/${action}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", origin: requestOrigin, ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json();
  assert.equal(response.status, expected, `${action}: unexpected status (${data.error?.code ?? "success"})`);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(data.version, "v1");
  checks++;
  return { response, data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}

async function mailToken() {
  await dispatchAuthEmails(pool, { ...config.email!, provider, policy });
  const message = delivery.pop();
  assert(message);
  const link = message.text.match(/https?:\/\/\S+/)?.[0];
  assert(link);
  const url = new URL(link);
  assert.equal(url.searchParams.get("token"), null);
  const token = new URLSearchParams(url.hash.slice(1)).get("token");
  assert(token);
  return token;
}

async function main() {
  assert.equal(await verifyPassword("not-an-account-password", null), false, "The public dummy hash never authenticates a missing account");
  assert.match(name, /^bep_auth_test_[a-f0-9]{32}$/);
  assert.notEqual(base.pathname, url.pathname);
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await runner({ databaseUrl: url.toString(), dir: path.resolve("migrations"), direction: "up", migrationsTable: "pgmigrations",
    count: Infinity, log: () => undefined });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  assert.equal((await request("config", 200)).data.data.enabled, true);
  const drainingRequest = new IncomingMessage(new Socket());
  drainingRequest.method = "POST";
  drainingRequest.headers = { origin: config.publicWebUrl, "content-type": "application/json" };
  const drainingResponse = new ServerResponse(drainingRequest);
  const drainHandled = createCustomerAuthHandler(pool, config)(drainingRequest, drainingResponse, new URL(`${origin}/api/v1/customer-auth/login`));
  for (let i = 0; i < 100 && drainingRequest.listenerCount("data") === 0; i++) await new Promise((resolve) => setTimeout(resolve, 10));
  assert(drainingRequest.listenerCount("data") > 0, "Shared peer limit completes before the body reader attaches");
  drainingRequest.emit("data", Buffer.alloc(17_000));
  await drainHandled;
  assert.equal(drainingResponse.statusCode, 413);
  assert.doesNotThrow(() => drainingRequest.emit("error", new Error("Test late transport error")));
  drainingRequest.emit("close");
  await request("session", 401);
  await request("session", 401, undefined, "authjs.session-token=admin-token");
  await request("login", 405);
  await request("unknown", 404);
  await request("login", 413, { email: "x".repeat(17_000), password });
  await request("login", 403, { email: "test@example.com", password }, undefined, "https://evil.example");
  await request("register", 400, { email: "test@example.com", password: "short", fullName: "Test" });
  await request("register", 400, { email: "test@example.com", password: "é".repeat(40), fullName: "Test" });
  await request("register", 400, { email: "test@example.com", password, fullName: "Test", role: "SUPER_ADMIN" });
  const signup = { email: "  TeSt@example.com ", password, fullName: "Auth Test", locale: "vi" };
  await request("register", 202, signup);
  const account = (await pool.query("SELECT * FROM customer_accounts")).rows[0];
  assert.equal(account.normalized_email, "test@example.com");
  assert.notEqual(account.password_hash, password);
  const ciphertext = JSON.stringify((await pool.query("SELECT payload FROM outbox_events")).rows);
  assert(!ciphertext.includes("test@example.com"));
  await request("register", 202, signup);
  assert.equal((await pool.query("SELECT count(*)::int n FROM customers")).rows[0].n, 1, "Duplicate registration rolls back orphan profile");
  assert.equal((await pool.query("SELECT count(*)::int n FROM customer_accounts")).rows[0].n, 1);
  const verification = await mailToken();
  await request("login", 401, { email: "test@example.com", password: "invalid-password" });
  await request("login", 401, { email: "missing@example.com", password });
  const login = await request("login", 200, { email: "TEST@example.com", password });
  assert(login.cookie);
  assert.match(login.response.headers.get("set-cookie")!, /HttpOnly; SameSite=Lax; Max-Age=2592000/);
  assert(!JSON.stringify(login.data).includes(login.cookie.split("=")[1]));
  const session = (await request("session", 200, undefined, login.cookie)).data.data;
  assert.equal(session.account.emailVerified, false);
  assert(Math.abs(new Date(session.expiresAt).getTime() - Date.now() - 30 * 86400_000) < 5000);
  const results = await Promise.all([verification, verification].map((token) => fetch(`${origin}/api/v1/customer-auth/verify-email`, {
    method: "POST", headers: { origin: config.publicWebUrl, "content-type": "application/json" }, body: JSON.stringify({ token })
  })));
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]); checks += 2;
  assert.equal((await request("session", 200, undefined, login.cookie)).data.data.account.emailVerified, true);
  await request("forgot-password", 202, { email: "missing@example.com" });
  await request("forgot-password", 202, { email: "test@example.com", locale: "en" });
  const reset = await mailToken();
  await request("verify-email", 400, { token: reset });
  const replacement = "Replacement-password-456!";
  const resets = await Promise.all([reset, reset].map((token) => fetch(`${origin}/api/v1/customer-auth/reset-password`, {
    method: "POST", headers: { origin: config.publicWebUrl, "content-type": "application/json" }, body: JSON.stringify({ token, password: replacement })
  })));
  assert.deepEqual(resets.map((r) => r.status).sort(), [200, 400]); checks += 2;
  await request("session", 401, undefined, login.cookie);
  await request("login", 401, { email: "test@example.com", password });
  const fresh = await request("login", 200, { email: "test@example.com", password: replacement });
  const second = await request("login", 200, { email: "test@example.com", password: replacement });
  await request("logout-all", 200, {}, fresh.cookie);
  await request("session", 401, undefined, second.cookie);
  await request("logout", 200, {}, second.cookie);
  const expired = newToken();
  await pool.query(`INSERT INTO customer_sessions(account_id,token_hash,created_at,expires_at)
    VALUES ($1,$2,now()-interval '32 days',now()-interval '2 days')`, [account.id, tokenHash(expired)]);
  await request("session", 401, undefined, `bnm_customer_session=${expired}`);
  const expiredReset = newToken();
  await pool.query(`INSERT INTO customer_auth_tokens(account_id,purpose,token_hash,target_email,created_at,expires_at)
    VALUES ($1,'RESET_PASSWORD',$2,'test@example.com',now()-interval '1 hour',now()-interval '30 minutes')`,
  [account.id, tokenHash(expiredReset)]);
  await request("reset-password", 400, { token: expiredReset, password: "Never-applied-password" });
  const oldTarget = newToken();
  await pool.query(`INSERT INTO customer_auth_tokens(account_id,purpose,token_hash,target_email,expires_at)
    VALUES ($1,'VERIFY_EMAIL',$2,'old-address@example.com',now()+interval '1 hour')`, [account.id, tokenHash(oldTarget)]);
  await request("verify-email", 400, { token: oldTarget });
  const activeBeforeDisable = await request("login", 200, { email: "test@example.com", password: replacement });
  await pool.query("UPDATE customer_accounts SET status='DISABLED' WHERE id=$1", [account.id]);
  await request("session", 401, undefined, activeBeforeDisable.cookie);
  await request("login", 401, { email: "test@example.com", password: replacement });
  assert.equal((await pool.query("SELECT count(*)::int n FROM admin_users")).rows[0].n, 0);
  assert.equal((await pool.query("SELECT count(*)::int n FROM orders")).rows[0].n, 0);
  assert((await pool.query("SELECT count(*)::int n FROM audit_logs WHERE action='CUSTOMER_PASSWORD_RESET'")).rows[0].n === 1);
  assert.equal(readCustomerAuthConfig({ NODE_ENV: "test" }).enabled, false);
  assert.throws(() => readCustomerAuthConfig({ CUSTOMER_AUTH_ENABLED: "true", NODE_ENV: "production" }), /production gate/);
  assert.throws(() => readCustomerAuthConfig({ CUSTOMER_AUTH_ENABLED: "true", NODE_ENV: "test" }), /SESSION_POLICY/);
  assert.match(sessionCookie(newToken(), true), /^__Host-bnm_customer_session=.*; Secure$/);
  assert.throws(() => readCustomerAuthConfig({ NODE_ENV: "test", CUSTOMER_AUTH_ENABLED: "true", CUSTOMER_AUTH_SESSION_POLICY: "fixed-revoke-on-password-reset" }), /RATE_LIMIT_KEY/);
  console.log(`Customer auth verification passed: ${checks} HTTP checks plus transaction, security and isolation assertions.`);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Customer auth verification failed."); process.exitCode = 1; })
  .finally(async () => {
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  });
