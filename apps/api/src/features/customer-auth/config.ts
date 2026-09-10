import type { EmailQueueConfig } from "./email";
import type { AuthRatePolicy } from "./rate-limit";
import type { OAuthProvider } from "./oauth-transactions";

export type CustomerOAuthConfig = {
  encryptionKey: string;
  providers: Partial<Record<OAuthProvider, { clientId: string; clientSecret: string; redirectUri: string; graphVersion?: string }>>;
};

export type CustomerAuthConfig = {
  enabled: boolean;
  publicWebUrl: string;
  secureCookies: boolean;
  email: EmailQueueConfig | null;
  rateLimit: AuthRatePolicy | null;
  oauth?: CustomerOAuthConfig | null;
};

export function readCustomerAuthConfig(env: NodeJS.ProcessEnv): CustomerAuthConfig {
  const enabled = env.CUSTOMER_AUTH_ENABLED === "true";
  const publicUrl = new URL(env.PUBLIC_WEB_URL ?? "http://localhost:3000");
  if (!["http:", "https:"].includes(publicUrl.protocol) || publicUrl.username || publicUrl.password ||
      publicUrl.pathname !== "/" || publicUrl.search || publicUrl.hash) {
    throw new Error("PUBLIC_WEB_URL must be a plain HTTP(S) origin.");
  }
  // Shared enforcement alone does not close OAuth, revocation and operational gates.
  if (enabled && env.NODE_ENV === "production") {
    throw new Error("Customer auth production gate: OAuth verification and security/operational policy approval required.");
  }
  if (enabled && env.CUSTOMER_AUTH_SESSION_POLICY !== "fixed-revoke-on-password-reset") {
    throw new Error("Explicit CUSTOMER_AUTH_SESSION_POLICY is required for local auth.");
  }
  const limit = Number(env.CUSTOMER_AUTH_RATE_LIMIT ?? "10");
  const windowSeconds = Number(env.CUSTOMER_AUTH_RATE_WINDOW_SECONDS ?? "60");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 3600) {
    throw new Error("Invalid customer auth rate limit.");
  }
  const rateKey = env.CUSTOMER_AUTH_RATE_LIMIT_KEY;
  if ((enabled && !rateKey) || (rateKey && (!/^[A-Za-z0-9+/]{43}=$/.test(rateKey) || Buffer.from(rateKey, "base64").length !== 32))) {
    throw new Error("CUSTOMER_AUTH_RATE_LIMIT_KEY must be a shared base64-encoded 32-byte key.");
  }
  const key = env.CUSTOMER_AUTH_EMAIL_KEY;
  if (key && (!/^[A-Za-z0-9+/]{43}=$/.test(key) || Buffer.from(key, "base64").length !== 32)) {
    throw new Error("CUSTOMER_AUTH_EMAIL_KEY must be a base64-encoded 32-byte key.");
  }
  return {
    enabled, publicWebUrl: publicUrl.origin, secureCookies: publicUrl.protocol === "https:",
    email: key ? { encryptionKey: key, publicWebUrl: publicUrl.origin } : null,
    rateLimit: rateKey ? { key: rateKey, limit, windowSeconds } : null,
    oauth: readOAuthConfig(env, publicUrl)
  };
}

function readOAuthConfig(env: NodeJS.ProcessEnv, publicUrl: URL): CustomerOAuthConfig | null {
  const providers: CustomerOAuthConfig["providers"] = {};
  const enabled = (["GOOGLE", "FACEBOOK"] as const).filter((provider) => env[`CUSTOMER_AUTH_${provider}_ENABLED`] === "true");
  if (!enabled.length) return null;
  const encryptionKey = env.CUSTOMER_AUTH_OAUTH_KEY ?? "";
  if (!/^[A-Za-z0-9+/]{43}=$/.test(encryptionKey) || Buffer.from(encryptionKey, "base64").length !== 32) {
    throw new Error("CUSTOMER_AUTH_OAUTH_KEY must be a backend-only base64-encoded 32-byte key.");
  }
  let allowlist: unknown;
  try { allowlist = JSON.parse(env.CUSTOMER_AUTH_OAUTH_REDIRECT_URIS ?? "[]"); }
  catch { throw new Error("CUSTOMER_AUTH_OAUTH_REDIRECT_URIS must be a JSON array."); }
  if (!Array.isArray(allowlist) || !allowlist.every((uri) => typeof uri === "string")) throw new Error("Invalid OAuth callback allowlist.");
  if (publicUrl.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(publicUrl.hostname)) {
    throw new Error("OAuth requires HTTPS outside local loopback.");
  }
  for (const provider of enabled) {
    const clientId = env[`CUSTOMER_AUTH_${provider}_CLIENT_ID`]?.trim();
    const clientSecret = env[`CUSTOMER_AUTH_${provider}_CLIENT_SECRET`]?.trim();
    const redirectUri = env[`CUSTOMER_AUTH_${provider}_REDIRECT_URI`];
    const expected = `${publicUrl.origin}/api/customer-auth/oauth/${provider.toLowerCase()}/callback`;
    if (!clientId || !clientSecret || redirectUri !== expected || !allowlist.includes(redirectUri)) {
      throw new Error(`Missing ${provider} credentials or exact allowlisted BFF callback URI.`);
    }
    const graphVersion = provider === "FACEBOOK" ? env.CUSTOMER_AUTH_FACEBOOK_GRAPH_VERSION : undefined;
    if (provider === "FACEBOOK" && (!graphVersion || !/^v\d+\.\d+$/.test(graphVersion))) throw new Error("Explicit CUSTOMER_AUTH_FACEBOOK_GRAPH_VERSION is required.");
    providers[provider] = { clientId, clientSecret, redirectUri, graphVersion };
  }
  return { encryptionKey, providers };
}
