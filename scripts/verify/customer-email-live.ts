import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import path from "node:path";
import pg from "pg";
import { runner } from "node-pg-migrate";
import { createCustomerAuthHandler } from "../../apps/api/src/features/customer-auth/http";
import { createResendEmailProvider, dispatchAuthEmails } from "../../apps/api/src/features/customer-auth/email";

// Opt-in only: sends exactly two messages to the explicitly approved test mailbox.
async function main() {
  assert.deepEqual(process.argv.slice(2), ["--send"], "Explicit --send required");
  const recipient = process.env.TEST_EMAIL_RECIPIENT?.trim();
  assert(recipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient), "Set TEST_EMAIL_RECIPIENT to an explicitly approved mailbox");
  assert.equal(process.env.NODE_ENV, "development");
  assert.equal(process.env.EMAIL_PROVIDER, "resend");
  assert.equal(process.env.CUSTOMER_AUTH_EMAIL_DISPATCH_ENABLED, "true");
  assert(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  const base = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL!);
  assert(["localhost", "127.0.0.1"].includes(base.hostname));
  const name = `bep_live_email_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(base);
  url.pathname = `/${name}`;
  const admin = new pg.Client({ connectionString: base.toString(), connectionTimeoutMillis: 3000 });
  const pool = new pg.Pool({ connectionString: url.toString(), connectionTimeoutMillis: 3000 });
  let created = false;
  let origin = "";
  let handler: ReturnType<typeof createCustomerAuthHandler>;
  const server = createServer((req, res) => {
    void handler(req, res, new URL(req.url!, origin)).then((handled) => {
      if (!handled) { res.writeHead(404); res.end(); }
    }).catch(() => { res.writeHead(500); res.end(); });
  });
  try {
    await admin.connect();
    assert(/^bep_live_email_[a-f0-9]{32}$/.test(name));
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    await runner({ databaseUrl: url.toString(), dir: path.resolve("migrations"), direction: "up",
      migrationsTable: "pgmigrations", checkOrder: false, singleTransaction: true,
      logger: { info() {}, warn() {}, error() {} } });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert(address && typeof address !== "string");
    origin = `http://127.0.0.1:${address.port}`;
    const email = { encryptionKey: randomBytes(32).toString("base64"), publicWebUrl: origin };
    handler = createCustomerAuthHandler(pool, { enabled: true, secureCookies: false,
      publicWebUrl: origin, email, oauth: null,
      rateLimit: { key: randomBytes(32).toString("base64"), limit: 100, windowSeconds: 60 } });
    const request = (action: string, body?: object, cookie?: string) => fetch(`${origin}/api/v1/customer-auth/${action}`, {
      method: body ? "POST" : "GET", headers: { Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000)
    });
    const password = randomBytes(32).toString("base64url");
    assert.equal((await request("register", { email: recipient, password, fullName: "Live email verification fixture", locale: "vi" })).status, 202);
    const login = await request("login", { email: recipient, password });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    assert(cookie);
    assert.equal((await request("forgot-password", { email: recipient, locale: "vi" })).status, 202);
    const links = new Map<string, URL>();
    const resend = createResendEmailProvider({ apiKey: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM });
    const result = await dispatchAuthEmails(pool, { ...email,
      policy: { batchSize: 2, maxAttempts: 1, baseDelaySeconds: 1, maxDelaySeconds: 1, leaseSeconds: 60 },
      provider: { async send(input) {
        assert.equal(input.to, recipient);
        const link = input.text.match(/https?:\/\/\S+/)?.[0];
        assert(link);
        const parsed = new URL(link);
        assert.equal(parsed.origin, origin);
        assert(!parsed.searchParams.has("token"));
        const mode = parsed.pathname.split("/").at(-1);
        assert.equal(parsed.pathname, `/vi/auth/${mode}`);
        assert(mode === "verify-email" || mode === "reset-password");
        assert(!links.has(mode));
        await resend.send({ ...input, subject: `[DEV AUTO TEST] ${input.subject}`,
          text: `Automated isolated test. These links are consumed automatically and the temporary server is removed after verification. Do not use them to change your real account.\n\n${input.text}` });
        links.set(mode, parsed);
      } }
    });
    console.log(JSON.stringify({ realEmailDispatch: result }));
    assert.equal(result.sent, 2);
    const ttls = await pool.query("SELECT purpose,EXTRACT(EPOCH FROM (expires_at-created_at))::int AS ttl FROM customer_auth_tokens");
    for (const row of ttls.rows) assert.equal(row.ttl, row.purpose === "VERIFY_EMAIL" ? 86400 : 1800);
    for (const mode of ["verify-email", "reset-password"]) {
      const token = new URLSearchParams(links.get(mode)!.hash.slice(1)).get("token");
      assert(token && /^[A-Za-z0-9_-]{43}$/.test(token));
      const body = mode === "verify-email" ? { token } : { token, password: randomBytes(32).toString("base64url") };
      assert.equal((await request(mode, body)).status, 200);
      assert.equal((await request(mode, body)).status, 400);
    }
    assert.equal((await request("session", undefined, cookie)).status, 401);
    assert.equal((await request("login", { email: recipient, password })).status, 401);
    assert.equal((await pool.query("SELECT email_verified_at IS NOT NULL AS verified FROM customer_accounts")).rows[0].verified, true);
    console.log("PASS: real Resend acceptance, generated link format, HTTP consumption/replay, TTL values and reset session revocation. Inbox/browser delivery NOT verified.");
  } finally {
    server.closeAllConnections();
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
}
void main().catch(() => { console.error("Live email verification failed; sensitive details suppressed."); process.exitCode = 1; });
