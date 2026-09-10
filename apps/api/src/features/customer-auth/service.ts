import type { Pool, PoolClient } from "pg";
import type { CustomerAuthConfig } from "./config";
import { queueAuthEmail } from "./email";
import { AuthError, hashPassword, newToken, SESSION_SECONDS, tokenHash, verifyPassword } from "./security";
import type { OAuthIdentity } from "./oauth-provider";

type AccountRow = {
  id: string; customer_id: string; normalized_email: string | null;
  full_name: string; email_verified_at: Date | null; password_hash: string | null; status: string;
};
type SessionRow = AccountRow & { expires_at: Date };
type Locale = "vi" | "en";
type Purpose = "VERIFY_EMAIL" | "RESET_PASSWORD";

export class CustomerAuthService {
  constructor(private readonly pool: Pool, private readonly config: CustomerAuthConfig) {}

  async register(input: { email: string; password: string; fullName: string; locale: Locale }) {
    this.requireEmail();
    const hash = await hashPassword(input.password);
    try {
      await this.transaction(async (client) => {
        const customer = await client.query<{ id: string }>(
          "INSERT INTO customers(full_name,email) VALUES ($1,$2) RETURNING id", [input.fullName, input.email]);
        const result = await client.query<AccountRow>(`INSERT INTO customer_accounts(customer_id,normalized_email,password_hash)
          VALUES ($1,$2,$3) RETURNING *`, [customer.rows[0].id, input.email, hash]);
        await this.issueEmailToken(client, result.rows[0], "VERIFY_EMAIL", input.locale);
        await audit(client, result.rows[0], "CUSTOMER_REGISTER", "GUEST");
      });
    } catch (error) {
      // Duplicate signup never changes an existing account/profile or reveals its existence.
      if (!isDuplicateEmail(error)) throw error;
    }
    return { accepted: true };
  }

  async login(email: string, password: string) {
    const result = await this.pool.query<AccountRow>("SELECT * FROM customer_accounts WHERE normalized_email=$1", [email]);
    const initial = result.rows[0];
    const valid = await verifyPassword(password, initial?.password_hash ?? null);
    if (!valid || !initial || initial.status !== "ACTIVE") throw invalidLogin();
    return this.transaction(async (client) => {
      const locked = await client.query<AccountRow>(`SELECT a.*,c.full_name FROM customer_accounts a
        JOIN customers c ON c.id=a.customer_id WHERE a.id=$1 FOR UPDATE OF a`, [initial.id]);
      const account = locked.rows[0];
      if (!account || account.status !== "ACTIVE" || account.password_hash !== initial.password_hash) throw invalidLogin();
      return this.createSession(client, account);
    });
  }

  async session(token: string | null) {
    if (!token) throw unauthenticated();
    const result = await this.pool.query<SessionRow>(`SELECT a.*,c.full_name,s.expires_at
      FROM customer_sessions s JOIN customer_accounts a ON a.id=s.account_id
      JOIN customers c ON c.id=a.customer_id
      WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND a.status='ACTIVE'`, [tokenHash(token)]);
    if (!result.rows[0]) throw unauthenticated();
    return sessionDto(result.rows[0]);
  }

  async loginOAuth(identity: OAuthIdentity) {
    if (!["GOOGLE", "FACEBOOK"].includes(identity.provider) || !identity.subject.trim() || identity.subject.length > 255) throw invalidOAuthAccount();
    try {
      return await this.transaction(async (client) => {
        // Serialize first-time callbacks for the same provider subject; never lock/link by email.
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify([identity.provider, identity.subject])]);
        const existing = await client.query<AccountRow>(`SELECT a.*,c.full_name FROM customer_identities i
          JOIN customer_accounts a ON a.id=i.account_id JOIN customers c ON c.id=a.customer_id
          WHERE i.provider=$1 AND i.provider_subject=$2 FOR UPDATE OF a`, [identity.provider, identity.subject]);
        let account = existing.rows[0];
        if (!account) {
          if (identity.provider === "GOOGLE" && !identity.emailVerified) throw invalidOAuthAccount();
          const email = identity.email?.trim().toLowerCase();
          if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalidOAuthAccount();
          const fullName = identity.fullName.trim().slice(0, 120) || "Customer";
          const customer = await client.query<{ id: string }>("INSERT INTO customers(full_name,email) VALUES ($1,$2) RETURNING id", [fullName, email]);
          const inserted = await client.query<AccountRow>(`INSERT INTO customer_accounts(customer_id,normalized_email,email_verified_at)
            VALUES ($1,$2,CASE WHEN $3 THEN now() ELSE NULL END) RETURNING *`, [customer.rows[0].id, email, identity.emailVerified]);
          account = { ...inserted.rows[0], full_name: fullName };
          await client.query("INSERT INTO customer_identities(account_id,provider,provider_subject) VALUES ($1,$2,$3)", [account.id, identity.provider, identity.subject]);
          await audit(client, account, "CUSTOMER_OAUTH_REGISTER", "GUEST");
        }
        if (account.status !== "ACTIVE") throw invalidOAuthAccount();
        return this.createSession(client, account);
      });
    } catch (error) {
      // A unique-email conflict rolls back the new profile; it never grants access to its owner.
      if (isDuplicateEmail(error)) throw invalidOAuthAccount();
      throw error;
    }
  }

  async logout(token: string | null) {
    if (token) await this.pool.query("UPDATE customer_sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL", [tokenHash(token)]);
    return { accepted: true };
  }

  async logoutAll(token: string | null) {
    await this.transaction(async (client) => {
      const account = await this.lockSessionAccount(client, token);
      await client.query("UPDATE customer_sessions SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL", [account.id]);
      await audit(client, account, "CUSTOMER_LOGOUT_ALL");
    });
    return { accepted: true };
  }

  async forgotPassword(email: string, locale: Locale) {
    this.requireEmail();
    await this.transaction(async (client) => {
      const result = await client.query<AccountRow>("SELECT * FROM customer_accounts WHERE normalized_email=$1 FOR UPDATE", [email]);
      const account = result.rows[0];
      // A local password is required: reset never silently converts an OAuth identity.
      if (account?.status === "ACTIVE" && account.password_hash) {
        await this.issueEmailToken(client, account, "RESET_PASSWORD", locale);
      }
    });
    return { accepted: true };
  }

  async resendVerification(token: string | null, locale: Locale) {
    this.requireEmail();
    await this.transaction(async (client) => {
      const account = await this.lockSessionAccount(client, token);
      if (!account.email_verified_at && account.normalized_email) {
        await this.issueEmailToken(client, account, "VERIFY_EMAIL", locale);
      }
    });
    return { accepted: true };
  }

  async consumeEmailToken(rawToken: string, purpose: Purpose, password?: string) {
    const hash = password ? await hashPassword(password) : null;
    await this.transaction(async (client) => {
      const candidate = await client.query<{ account_id: string }>(
        "SELECT account_id FROM customer_auth_tokens WHERE token_hash=$1 AND purpose=$2", [tokenHash(rawToken), purpose]);
      if (!candidate.rows[0]) throw invalidToken();
      // Account -> token -> sessions is the common order, also used by login/reset/resend.
      const accounts = await client.query<AccountRow>("SELECT * FROM customer_accounts WHERE id=$1 FOR UPDATE", [candidate.rows[0].account_id]);
      const account = accounts.rows[0];
      if (!account || account.status !== "ACTIVE") throw invalidToken();
      const tokens = await client.query<{ id: string; target_email: string | null }>(`SELECT id,target_email FROM customer_auth_tokens
        WHERE token_hash=$1 AND purpose=$2 AND consumed_at IS NULL AND revoked_at IS NULL
        AND expires_at>clock_timestamp() FOR UPDATE`, [tokenHash(rawToken), purpose]);
      const token = tokens.rows[0];
      if (!token || token.target_email !== account.normalized_email) throw invalidToken();
      if (purpose === "VERIFY_EMAIL") {
        await client.query("UPDATE customer_accounts SET email_verified_at=COALESCE(email_verified_at,now()),updated_at=now() WHERE id=$1", [account.id]);
      } else {
        if (!hash || !account.password_hash) throw invalidToken();
        await client.query("UPDATE customer_accounts SET password_hash=$2,updated_at=now() WHERE id=$1", [account.id, hash]);
        await client.query("UPDATE customer_sessions SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL", [account.id]);
      }
      await client.query("UPDATE customer_auth_tokens SET consumed_at=now() WHERE id=$1", [token.id]);
      await client.query(`UPDATE customer_auth_tokens SET revoked_at=now() WHERE account_id=$1 AND purpose=$2
        AND id<>$3 AND consumed_at IS NULL AND revoked_at IS NULL`, [account.id, purpose, token.id]);
      await audit(client, account, purpose === "VERIFY_EMAIL" ? "CUSTOMER_EMAIL_VERIFIED" : "CUSTOMER_PASSWORD_RESET", "GUEST");
    });
    return { accepted: true };
  }

  private async createSession(client: PoolClient, account: AccountRow) {
    const token = newToken();
    const result = await client.query<{ expires_at: Date }>(`INSERT INTO customer_sessions(account_id,token_hash,expires_at)
      VALUES ($1,$2,now()+$3*interval '1 second') RETURNING expires_at`, [account.id, tokenHash(token), SESSION_SECONDS]);
    await audit(client, account, "CUSTOMER_LOGIN");
    return { token, session: sessionDto({ ...account, expires_at: result.rows[0].expires_at }) };
  }

  private async lockSessionAccount(client: PoolClient, rawToken: string | null) {
    if (!rawToken) throw unauthenticated();
    const initial = await client.query<{ account_id: string }>("SELECT account_id FROM customer_sessions WHERE token_hash=$1", [tokenHash(rawToken)]);
    if (!initial.rows[0]) throw unauthenticated();
    const accounts = await client.query<AccountRow>("SELECT * FROM customer_accounts WHERE id=$1 FOR UPDATE", [initial.rows[0].account_id]);
    const account = accounts.rows[0];
    const sessions = await client.query(`SELECT id FROM customer_sessions WHERE token_hash=$1
      AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE`, [tokenHash(rawToken)]);
    if (!account || account.status !== "ACTIVE" || !sessions.rowCount) throw unauthenticated();
    return account;
  }

  private async issueEmailToken(client: PoolClient, account: AccountRow, purpose: Purpose, locale: Locale) {
    const config = this.requireEmail();
    const token = newToken();
    await client.query(`UPDATE customer_auth_tokens SET revoked_at=now() WHERE account_id=$1 AND purpose=$2
      AND consumed_at IS NULL AND revoked_at IS NULL`, [account.id, purpose]);
    await client.query(`INSERT INTO customer_auth_tokens(account_id,purpose,token_hash,target_email,expires_at)
      VALUES ($1,$2,$3,$4,now()+$5*interval '1 second')`,
    [account.id, purpose, tokenHash(token), account.normalized_email, purpose === "VERIFY_EMAIL" ? 86_400 : 1_800]);
    await queueAuthEmail(client, { accountId: account.id, token, purpose, email: account.normalized_email!, locale }, config);
  }

  private requireEmail() {
    if (!this.config.email) throw new AuthError(503, "EMAIL_NOT_CONFIGURED", "Email delivery is not configured.");
    return this.config.email;
  }

  private async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout='3s'");
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

function sessionDto(row: SessionRow) {
  return { account: { id: row.id, customerId: row.customer_id, email: row.normalized_email,
    fullName: row.full_name, emailVerified: row.email_verified_at !== null }, expiresAt: row.expires_at.toISOString() };
}
const unauthenticated = () => new AuthError(401, "UNAUTHENTICATED", "Sign in is required.");
const invalidLogin = () => new AuthError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
const invalidOAuthAccount = () => new AuthError(403, "OAUTH_ACCOUNT_UNAVAILABLE", "Unable to sign in with this provider.");
const invalidToken = () => new AuthError(400, "INVALID_TOKEN", "Token is invalid or expired.");
function isDuplicateEmail(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505" &&
    "constraint" in error && error.constraint === "idx_customer_accounts_normalized_email";
}

async function audit(client: PoolClient, account: AccountRow, action: string, actor: "CUSTOMER" | "GUEST" = "CUSTOMER") {
  await client.query(`INSERT INTO audit_logs(action,entity_type,entity_id,actor_type,actor_customer_id,metadata)
    VALUES ($1,'CUSTOMER_ACCOUNT',$2,$3,$4,'{}')`, [action, account.id, actor, actor === "CUSTOMER" ? account.customer_id : null]);
}
