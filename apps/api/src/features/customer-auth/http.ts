import type { IncomingMessage, ServerResponse } from "node:http";
import type { Pool } from "pg";
import type { z } from "zod";
import { errorEnvelope, successEnvelope } from "../../contracts/v1/envelope";
import type { CustomerAuthConfig } from "./config";
import { AuthError, readSessionCookie, sessionCookie, tokenHash } from "./security";
import { AuthRateLimitError, SharedAuthLimiter } from "./rate-limit";
import { CustomerAuthService } from "./service";
import { authSchemas } from "./validation";
import { createOAuthHandler } from "./oauth-http";
import type { OAuthProviderAdapter } from "./oauth-provider";
import type { OAuthProvider } from "./oauth-transactions";

export function createCustomerAuthHandler(pool: Pool, config: CustomerAuthConfig, oauthProviders?: Partial<Record<OAuthProvider, OAuthProviderAdapter>>) {
  const service = new CustomerAuthService(pool, config);
  const oauth = createOAuthHandler(pool, config, service, oauthProviders);
  if (config.enabled && !config.rateLimit) throw new Error("Shared customer auth rate policy is required.");
  const limiter = config.rateLimit ? new SharedAuthLimiter(pool, config.rateLimit) : null;
  const peerLimiter = config.rateLimit ? new SharedAuthLimiter(pool, { ...config.rateLimit, limit: config.rateLimit.limit * 10 }) : null;
  return async (request: IncomingMessage, response: ServerResponse, url: URL) => {
    if (!url.pathname.startsWith("/api/v1/customer-auth/")) return false;
    const action = url.pathname.slice("/api/v1/customer-auth/".length);
    try {
      if (await oauth.handle(request, response, url)) return true;
      const isGet = action === "config" || action === "session";
      if (!isGet && !Object.hasOwn(authSchemas, action)) {
        throw new AuthError(404, "NOT_FOUND", "Route not found.");
      }
      const method = isGet ? "GET" : "POST";
      if (request.method !== method) {
        response.setHeader("Allow", method);
        throw new AuthError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
      }
      if (url.search) throw new AuthError(400, "VALIDATION_ERROR", "Query parameters are not accepted.");
      if (action === "config") {
        send(response, 200, successEnvelope({ enabled: config.enabled, emailEnabled: config.enabled && Boolean(config.email),
          oauth: oauth.available }));
        return true;
      }
      if (!config.enabled) throw new AuthError(503, "AUTH_NOT_ENABLED", "Customer authentication is not enabled.");
      const token = readSessionCookie(request.headers.cookie, config.secureCookies);
      if (isGet) {
        send(response, 200, successEnvelope(await service.session(token)));
        return true;
      }
      if (request.headers.origin !== config.publicWebUrl || request.headers["sec-fetch-site"] === "cross-site") {
        throw new AuthError(403, "ORIGIN_NOT_ALLOWED", "Request origin is not allowed.");
      }
      const address = request.socket.remoteAddress ?? "unknown";
      await peerLimiter!.enforce("PEER", address);
      const body = await readJson(request);
      const email = body && typeof body === "object" && "email" in body && typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
      const proof = body && typeof body === "object" && "token" in body && typeof body.token === "string" ? body.token : null;
      const identity = email ? `email:${tokenHash(email)}` : token ? `session:${tokenHash(token)}` :
        proof ? `proof:${tokenHash(proof)}` : `anonymous:${address}`;
      await limiter!.enforce(action.replaceAll("-", "_").toUpperCase(), identity);
      const data = await execute(action, body, token, service, response, config);
      send(response, action === "register" || action === "forgot-password" || action === "resend-verification" ? 202 : 200, successEnvelope(data));
    } catch (error) {
      if (error instanceof AuthError) {
        if (error instanceof AuthRateLimitError) response.setHeader("Retry-After", String(error.retryAfterSeconds));
        send(response, error.status, errorEnvelope(error.code, error.message));
      } else {
        send(response, 500, errorEnvelope("INTERNAL_ERROR", "Service error."));
      }
    }
    return true;
  };
}

async function execute(action: string, body: unknown, token: string | null, service: CustomerAuthService,
  response: ServerResponse, config: CustomerAuthConfig) {
  switch (action) {
    case "register": return service.register(parse(authSchemas.register, body));
    case "login": {
      const input = parse(authSchemas.login, body);
      const result = await service.login(input.email, input.password);
      response.setHeader("Set-Cookie", sessionCookie(result.token, config.secureCookies));
      return result.session;
    }
    case "logout":
      parse(authSchemas.logout, body);
      await service.logout(token);
      response.setHeader("Set-Cookie", sessionCookie(null, config.secureCookies));
      return { accepted: true };
    case "logout-all":
      parse(authSchemas["logout-all"], body);
      await service.logoutAll(token);
      response.setHeader("Set-Cookie", sessionCookie(null, config.secureCookies));
      return { accepted: true };
    case "forgot-password": {
      const input = parse(authSchemas["forgot-password"], body);
      return service.forgotPassword(input.email, input.locale);
    }
    case "reset-password": {
      const input = parse(authSchemas["reset-password"], body);
      const result = await service.consumeEmailToken(input.token, "RESET_PASSWORD", input.password);
      response.setHeader("Set-Cookie", sessionCookie(null, config.secureCookies));
      return result;
    }
    case "verify-email": return service.consumeEmailToken(parse(authSchemas["verify-email"], body).token, "VERIFY_EMAIL");
    case "resend-verification": return service.resendVerification(token, parse(authSchemas["resend-verification"], body).locale);
    default: throw new AuthError(404, "NOT_FOUND", "Route not found.");
  }
}

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new AuthError(400, "VALIDATION_ERROR", "Invalid request fields.");
  return parsed.data;
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  if (request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new AuthError(415, "UNSUPPORTED_MEDIA_TYPE", "JSON content type is required.");
  }
  const body = await new Promise<Buffer>((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    const cleanup = () => {
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("error", onError);
      request.off("aborted", onAborted);
      clearTimeout(timer);
    };
    const fail = (error: AuthError) => {
      cleanup();
      // Drain without destroying the response socket; absorb late transport errors until close.
      const ignoreDrainError = () => undefined;
      request.on("error", ignoreDrainError);
      request.once("close", () => request.off("error", ignoreDrainError));
      request.resume();
      reject(error);
    };
    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size > 16_384) fail(new AuthError(413, "PAYLOAD_TOO_LARGE", "Request is too large."));
      else chunks.push(chunk);
    };
    const onEnd = () => { cleanup(); resolve(Buffer.concat(chunks)); };
    const onError = () => fail(new AuthError(400, "VALIDATION_ERROR", "Invalid request body."));
    const onAborted = () => fail(new AuthError(400, "VALIDATION_ERROR", "Request was aborted."));
    const timer = setTimeout(() => fail(new AuthError(408, "REQUEST_TIMEOUT", "Request timed out.")), 5000);
    request.on("data", onData);
    request.once("end", onEnd);
    request.once("error", onError);
    request.once("aborted", onAborted);
  });
  try { return JSON.parse(body.toString("utf8")); }
  catch { throw new AuthError(400, "VALIDATION_ERROR", "Invalid JSON."); }
}

function send(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
    "referrer-policy": "no-referrer", "x-content-type-options": "nosniff" });
  response.end(JSON.stringify(data));
}
