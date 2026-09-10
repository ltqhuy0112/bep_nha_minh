import type { IncomingMessage, ServerResponse } from "node:http";
import type { Pool } from "pg";
import { cartCommandSchema } from "@bep-nha-minh/shared/schemas/cart";
import { errorEnvelope, successEnvelope } from "../../contracts/v1/envelope";
import type { CustomerAuthConfig } from "../customer-auth/config";
import { readJson, send } from "../customer-auth/http";
import { AuthError, newToken, TOKEN_PATTERN } from "../customer-auth/security";
import { AuthRateLimitError, SharedAuthLimiter } from "../customer-auth/rate-limit";
import { CartService } from "./service";

function limit(value: string | undefined, fallback: number) {
  if (value === undefined) return fallback;
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1 || result > 10000) throw new Error("Invalid cart quantity policy");
  return result;
}
export function createCartHandler(pool: Pool, config: CustomerAuthConfig, limits = {
  perProduct: limit(process.env.CART_MAX_PER_PRODUCT, 20), total: limit(process.env.CART_MAX_TOTAL_QUANTITY, 50),
}) {
  const service = new CartService(pool, config, limits);
  const limiter = config.rateLimit ? new SharedAuthLimiter(pool, config.rateLimit) : null;
  const prefix = config.secureCookies ? "__Host-" : "";
  const guestName = `${prefix}bnm_guest_cart`;
  const cookie = (token: string | null) => `${guestName}=${token ?? ""}; Path=/; HttpOnly; SameSite=Lax${token ? "" : "; Max-Age=0"}${config.secureCookies ? "; Secure" : ""}`;
  return async (request: IncomingMessage, response: ServerResponse, url: URL) => {
    if (url.pathname !== "/api/v1/cart") return false;
    try {
      if (!["GET", "POST"].includes(request.method ?? "")) {
        response.setHeader("Allow", "GET, POST"); throw new AuthError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
      }
      const session = readToken(request.headers.cookie, `${prefix}bnm_customer_session`);
      let guest = readToken(request.headers.cookie, guestName);
      if (session && !config.enabled) throw new AuthError(503, "AUTH_NOT_ENABLED", "Account carts are unavailable.");
      if (request.method === "GET") {
        if ([...url.searchParams.keys()].some((key) => key !== "locale") || url.searchParams.getAll("locale").length !== 1) throw new AuthError(400, "VALIDATION_ERROR", "Invalid query.");
        const locale = url.searchParams.get("locale");
        if (locale !== "vi" && locale !== "en") throw new AuthError(400, "VALIDATION_ERROR", "Invalid locale.");
        send(response, 200, successEnvelope(await service.execute(session, guest, locale))); return true;
      }
      if (url.search) throw new AuthError(400, "VALIDATION_ERROR", "Invalid query.");
      if (request.headers.origin !== config.publicWebUrl || request.headers["sec-fetch-site"] === "cross-site") throw new AuthError(403, "ORIGIN_NOT_ALLOWED", "Invalid origin.");
      if (!limiter) throw new AuthError(503, "CART_NOT_CONFIGURED", "Shared rate limiting is required.");
      // Includes initialization: minting a fresh guest cookie cannot bypass the network bucket.
      await limiter.enforce("CART_WRITE_NETWORK", request.socket.remoteAddress ?? "unknown");
      const parsed = cartCommandSchema.safeParse(await readJson(request));
      if (!parsed.success) throw new AuthError(400, "VALIDATION_ERROR", "Invalid cart command.");
      const command = parsed.data;
      let issued: string | null = null;
      if (command.action === "initialize" && !session) {
        const current = guest ? await service.execute(null, guest, command.locale) : null;
        if (!current?.id) { issued = newToken(); guest = issued; }
      }
      const result = await service.execute(session, guest, command.locale, command);
      if (issued) response.setHeader("Set-Cookie", cookie(issued));
      if (command.action === "merge") response.setHeader("Set-Cookie", cookie(null));
      send(response, 200, successEnvelope(result));
    } catch (error) {
      if (error instanceof AuthError) {
        if (error instanceof AuthRateLimitError) response.setHeader("Retry-After", String(error.retryAfterSeconds));
        send(response, error.status, errorEnvelope(error.code, error.message));
      } else send(response, 500, errorEnvelope("INTERNAL_ERROR", "Cart request failed."));
    }
    return true;
  };
}
function readToken(raw: string | undefined, name: string) {
  const parts = (raw ?? "").split(";").map((p) => p.trim()).filter((p) => p.split("=")[0] === name);
  if (!parts.length) return null;
  const token = parts[0].slice(name.length + 1);
  if (parts.length !== 1 || !TOKEN_PATTERN.test(token)) throw new AuthError(401, "INVALID_CREDENTIAL", "Invalid cart credential.");
  return token;
}
