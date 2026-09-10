import type { IncomingMessage, ServerResponse } from "node:http";
import type { Pool } from "pg";
import { z } from "zod";
import { customerAddressSchema } from "@bep-nha-minh/shared/schemas/customer-address";
import { errorEnvelope, successEnvelope } from "../../contracts/v1/envelope";
import type { CustomerAuthConfig } from "../customer-auth/config";
import { readJson, send } from "../customer-auth/http";
import { AuthError, readSessionCookie, tokenHash } from "../customer-auth/security";
import { AuthRateLimitError, SharedAuthLimiter } from "../customer-auth/rate-limit";
import { CustomerAuthService } from "../customer-auth/service";
import { CustomerAddressService } from "./service";

export function createCustomerAddressHandler(pool: Pool, config: CustomerAuthConfig) {
  const service = new CustomerAddressService(new CustomerAuthService(pool, config));
  if (config.enabled && !config.rateLimit) throw new Error("Shared customer rate policy is required.");
  const limiter = config.rateLimit ? new SharedAuthLimiter(pool, config.rateLimit) : null;
  return async (request: IncomingMessage, response: ServerResponse, url: URL) => {
    if (url.pathname !== "/api/v1/customer-addresses" && !url.pathname.startsWith("/api/v1/customer-addresses/")) return false;
    try {
      if (!config.enabled) throw new AuthError(503, "AUTH_NOT_ENABLED", "Customer authentication is not enabled.");
      const parts = url.pathname.slice("/api/v1/customer-addresses".length).split("/").filter(Boolean);
      if (url.search || parts.length > 2 || (parts.length && !z.uuid().safeParse(parts[0]).success) || (parts.length === 2 && parts[1] !== "default")) {
        throw new AuthError(400, "VALIDATION_ERROR", "Invalid address route.");
      }
      const methods = !parts.length ? ["GET", "POST"] : parts.length === 1 ? ["PUT", "DELETE"] : ["PUT"];
      if (!methods.includes(request.method ?? "")) {
        response.setHeader("Allow", methods.join(", "));
        throw new AuthError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
      }
      const token = readSessionCookie(request.headers.cookie, config.secureCookies);
      if (!token) throw new AuthError(401, "UNAUTHENTICATED", "Sign in is required.");
      if (request.method === "GET") {
        send(response, 200, successEnvelope(await service.list(token)));
        return true;
      }
      if (request.headers.origin !== config.publicWebUrl || request.headers["sec-fetch-site"] === "cross-site") {
        throw new AuthError(403, "ORIGIN_NOT_ALLOWED", "Request origin is not allowed.");
      }
      await limiter!.enforce("ADDRESS_WRITE", tokenHash(token));
      const body = await readJson(request);
      const isSave = request.method === "POST" || (request.method === "PUT" && parts.length === 1);
      const parsed = (isSave ? customerAddressSchema : z.strictObject({})).safeParse(body);
      if (!parsed.success) throw new AuthError(400, "VALIDATION_ERROR", "Invalid address fields.");
      const result = isSave ? await service.save(token, customerAddressSchema.parse(parsed.data), parts[0])
        : request.method === "DELETE" ? await service.remove(token, parts[0]) : await service.setDefault(token, parts[0]);
      send(response, request.method === "POST" ? 201 : 200, successEnvelope(result));
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "22023") {
        send(response, 400, errorEnvelope("INVALID_LOCATION", "Select a valid province and ward."));
        return true;
      }
      if (typeof error === "object" && error !== null && "code" in error && error.code === "55000") {
        send(response, 503, errorEnvelope("LOCATIONS_NOT_READY", "Location reference data is not ready."));
        return true;
      }
      if (error instanceof AuthError) {
        if (error instanceof AuthRateLimitError) response.setHeader("Retry-After", String(error.retryAfterSeconds));
        send(response, error.status, errorEnvelope(error.code, error.message));
      } else send(response, 500, errorEnvelope("INTERNAL_ERROR", "Service error."));
    }
    return true;
  };
}
