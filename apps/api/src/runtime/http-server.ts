import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { errorEnvelope, successEnvelope } from "../contracts/v1/envelope";
import { foundationOpenApiDocument } from "../contracts/v1/openapi";
import { handleCatalogRequest } from "../features/catalog/http";
import type { CatalogDatabase } from "../features/catalog/database";
import { getLiveHealth, isReady, type HealthDependencies } from "./health";
import type { createCustomerAuthHandler } from "../features/customer-auth/http";
import type { createCustomerAddressHandler } from "../features/customer-addresses/http";
import type { createLocationHandler } from "../features/locations/http";
import type { createCartHandler } from "../features/cart/http";

export type ApiServerOptions = HealthDependencies & {
  catalogDatabase?: CatalogDatabase;
  customerAuthHandler?: ReturnType<typeof createCustomerAuthHandler>;
  customerAddressHandler?: ReturnType<typeof createCustomerAddressHandler>;
  locationHandler?: ReturnType<typeof createLocationHandler>;
  cartHandler?: ReturnType<typeof createCartHandler>;
};

export function createApiServer(options: ApiServerOptions = {}): Server {
  return createServer((request, response) => {
    void handleRequest(request, response, options).catch(() => {
      if (!response.writableEnded) {
        sendJson(response, 500, errorEnvelope("INTERNAL_ERROR", "Service error."));
      }
    });
  });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: ApiServerOptions
) {
  let url: URL;
  try {
    url = new URL(request.url ?? "/", "http://localhost");
  } catch {
    sendJson(response, 400, errorEnvelope("BAD_REQUEST", "Invalid request target."));
    return;
  }
  const path = url.pathname;

  if (options.customerAuthHandler && await options.customerAuthHandler(request, response, url)) return;
  if (options.customerAddressHandler && await options.customerAddressHandler(request, response, url)) return;
  if (options.locationHandler && await options.locationHandler(request, response, url)) return;
  if (options.cartHandler && await options.cartHandler(request, response, url)) return;

  if (path === "/api/v1/health/live") {
    if (request.method !== "GET") {
      sendMethodNotAllowed(response);
      return;
    }
    sendJson(response, 200, successEnvelope(getLiveHealth()));
    return;
  }

  if (path === "/api/v1/health/ready") {
    if (request.method !== "GET") {
      sendMethodNotAllowed(response);
      return;
    }
    const ready = await isReady(options);
    if (ready) {
      sendJson(response, 200, successEnvelope(getLiveHealth()));
      return;
    }
    sendJson(response, 503, errorEnvelope("SERVICE_UNAVAILABLE", "Service is not ready."));
    return;
  }

  if (path === "/api/v1/openapi.json") {
    if (request.method !== "GET") {
      sendMethodNotAllowed(response);
      return;
    }
    sendJson(response, 200, foundationOpenApiDocument);
    return;
  }

  if (options.catalogDatabase) {
    const handled = await handleCatalogRequest(
      path,
      request.method,
      url.searchParams,
      response,
      options.catalogDatabase
    );
    if (handled) return;
  }

  sendJson(response, 404, errorEnvelope("NOT_FOUND", "Route not found."));
}

function sendMethodNotAllowed(response: ServerResponse) {
  response.setHeader("Allow", "GET");
  sendJson(response, 405, errorEnvelope("METHOD_NOT_ALLOWED", "Method not allowed."));
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}
