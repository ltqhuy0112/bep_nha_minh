import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

export const SESSION_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_COOKIE = "bnm_customer_session";
export const SECURE_SESSION_COOKIE = "__Host-bnm_customer_session";
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const newToken = () => randomBytes(32).toString("base64url");
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const hashPassword = (password: string) => bcrypt.hash(password, 12);

// Public dummy value, never an account credential; avoid synchronous hashing at module load.
const dummyHash = "$2b$12$XFYGy9SH0cDJEGy5q5/uBOlqXw72m2K9ODFxwtXRCD5UB2CSUj6FG";
export async function verifyPassword(password: string, hash: string | null) {
  const matches = await bcrypt.compare(password, hash ?? dummyHash);
  return hash !== null && matches;
}

export function readSessionCookie(cookie: string | undefined, secure: boolean) {
  const name = secure ? SECURE_SESSION_COOKIE : SESSION_COOKIE;
  const matches = (cookie ?? "").split(";").map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(name.length + 1);
  return TOKEN_PATTERN.test(value) ? value : null;
}

export function sessionCookie(token: string | null, secure: boolean) {
  const name = secure ? SECURE_SESSION_COOKIE : SESSION_COOKIE;
  return `${name}=${token ?? ""}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? SESSION_SECONDS : 0}${secure ? "; Secure" : ""}`;
}

export class AuthError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}
