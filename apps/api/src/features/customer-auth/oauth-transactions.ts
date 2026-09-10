import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { AuthError, newToken, tokenHash, TOKEN_PATTERN } from "./security";

export type OAuthProvider = "GOOGLE" | "FACEBOOK";
export type OAuthTransactionConfig = {
  encryptionKey: string;
  redirectUris: Partial<Record<OAuthProvider, string>>;
};
type Ciphertext = { iv: string; tag: string; data: string };
type TransactionRow = {
  id: string;
  locale: "vi" | "en";
  redirect_uri: string;
  pkce_ciphertext: Ciphertext | null;
};

export class OAuthTransactionStore {
  private readonly key: Buffer;
  private readonly redirectUris: Partial<Record<OAuthProvider, string>>;

  constructor(private readonly pool: Pool, config: OAuthTransactionConfig) {
    this.key = Buffer.from(config.encryptionKey, "base64");
    if (!/^[A-Za-z0-9+/]{43}=$/.test(config.encryptionKey) || this.key.length !== 32) {
      throw new Error("OAuth encryption requires a base64-encoded 32-byte key.");
    }
    this.redirectUris = { ...config.redirectUris };
    for (const uri of Object.values(this.redirectUris)) {
      const url = new URL(uri);
      const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if ((url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) ||
          url.username || url.password || url.search || url.hash || url.href !== uri) {
        throw new Error("OAuth callbacks require exact HTTPS URLs (HTTP loopback only for local tests).");
      }
    }
  }

  async create(input: { provider: OAuthProvider; locale: "vi" | "en"; pkceVerifier?: string }) {
    if (!["GOOGLE", "FACEBOOK"].includes(input.provider)) throw invalidTransaction();
    const redirectUri = this.redirectUris[input.provider];
    if (!redirectUri || !["vi", "en"].includes(input.locale)) throw invalidTransaction();
    if (input.pkceVerifier !== undefined && !/^[A-Za-z0-9._~-]{43,128}$/.test(input.pkceVerifier)) throw invalidTransaction();
    const state = newToken();
    const browserBinding = newToken();
    const stateHash = tokenHash(state);
    const bindingHash = tokenHash(browserBinding);
    const aad = additionalData(input.provider, stateHash, bindingHash, redirectUri, input.locale);
    const encrypted = input.pkceVerifier === undefined ? null : this.encrypt(input.pkceVerifier, aad);
    const result = await this.pool.query<{ expires_at: Date }>(`
      INSERT INTO customer_oauth_transactions
        (provider, state_hash, browser_binding_hash, pkce_ciphertext, redirect_uri, locale, created_at, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,statement_timestamp(),statement_timestamp()+interval '10 minutes')
      RETURNING expires_at
    `, [input.provider, stateHash, bindingHash, encrypted, redirectUri, input.locale]);
    return { state, browserBinding, redirectUri, expiresAt: result.rows[0].expires_at.toISOString() };
  }

  async consume(input: { provider: OAuthProvider; state: string; browserBinding: string }) {
    if (!["GOOGLE", "FACEBOOK"].includes(input.provider)) throw invalidTransaction();
    const redirectUri = this.redirectUris[input.provider];
    if (!redirectUri || !TOKEN_PATTERN.test(input.state) || !TOKEN_PATTERN.test(input.browserBinding)) throw invalidTransaction();
    const stateHash = tokenHash(input.state);
    const bindingHash = tokenHash(input.browserBinding);
    const client = await this.pool.connect().catch(() => { throw unavailableTransaction(); });
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '3s'");
      const locked = await client.query<TransactionRow>(`
        SELECT id, locale, redirect_uri, pkce_ciphertext FROM customer_oauth_transactions
        WHERE provider=$1 AND state_hash=$2 AND browser_binding_hash=$3 AND redirect_uri=$4
        FOR UPDATE
      `, [input.provider, stateHash, bindingHash, redirectUri]);
      const row = locked.rows[0];
      if (!row) throw invalidTransaction();
      // Recheck wall-clock expiry after obtaining the lock, not at transaction start.
      const consumed = await client.query(`
        UPDATE customer_oauth_transactions SET consumed_at=clock_timestamp()
        WHERE id=$1 AND consumed_at IS NULL AND expires_at>clock_timestamp()
        RETURNING id
      `, [row.id]);
      if (!consumed.rowCount) throw invalidTransaction();
      const aad = additionalData(input.provider, stateHash, bindingHash, row.redirect_uri, row.locale);
      const pkceVerifier = row.pkce_ciphertext === null ? undefined : this.decrypt(row.pkce_ciphertext, aad);
      await client.query("COMMIT");
      // Provider network exchange must start only after this committed single-use claim.
      return { provider: input.provider, locale: row.locale, redirectUri: row.redirect_uri, pkceVerifier };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (error instanceof AuthError) throw error;
      throw unavailableTransaction();
    } finally {
      client.release();
    }
  }

  private encrypt(verifier: string, aad: Buffer): Ciphertext {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(aad);
    const data = Buffer.concat([cipher.update(verifier, "utf8"), cipher.final()]);
    return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
  }

  private decrypt(encrypted: Ciphertext, aad: Buffer) {
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(encrypted.iv, "base64"));
    decipher.setAAD(aad);
    decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted.data, "base64")), decipher.final()]).toString("utf8");
  }
}

function additionalData(provider: OAuthProvider, stateHash: string, bindingHash: string, redirectUri: string, locale: string) {
  return Buffer.from(JSON.stringify([provider, stateHash, bindingHash, redirectUri, locale]));
}

const invalidTransaction = () => new AuthError(400, "INVALID_OAUTH_TRANSACTION", "OAuth transaction is invalid or expired.");
const unavailableTransaction = () => new AuthError(503, "OAUTH_TRANSACTION_UNAVAILABLE", "Authentication is temporarily unavailable.");

export async function cleanupOAuthTransactions(pool: Pool, batchSize = 1000) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 10_000) throw new Error("Invalid cleanup batch size.");
  const result = await pool.query(`
    WITH expired AS (
      SELECT id FROM customer_oauth_transactions WHERE expires_at <= statement_timestamp()
      ORDER BY expires_at LIMIT $1 FOR UPDATE SKIP LOCKED
    )
    DELETE FROM customer_oauth_transactions AS transactions USING expired WHERE transactions.id=expired.id
  `, [batchSize]);
  return result.rowCount ?? 0;
}
