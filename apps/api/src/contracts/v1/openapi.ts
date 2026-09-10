import { API_VERSION } from "./envelope";
import { customerAuthOpenApiPaths } from "../../features/customer-auth/openapi";
import { customerAddressOpenApiPaths } from "../../features/customer-addresses/openapi";
import { locationOpenApiPaths } from "../../features/locations/openapi";
import { cartOpenApiPaths } from "../../features/cart/openapi";

function buildOpenApiDocument() {
  return {
  openapi: "3.1.0",
  info: {
    title: "Bep Nha Minh API",
    version: API_VERSION,
    description: "Standalone API, public catalog and gated customer authentication."
  },
  paths: {
    ...customerAuthOpenApiPaths,
    ...customerAddressOpenApiPaths,
    ...locationOpenApiPaths,
    ...cartOpenApiPaths,
    "/api/v1/catalog/products": {
      get: {
        summary: "List visible catalog products",
        parameters: [
          { name: "locale", in: "query", required: true, description: "Requested translation. No fallback is applied.", schema: { type: "string", enum: ["vi", "en"] } },
          { name: "page", in: "query", required: false, description: "One-based page number. Defaults to 1.", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "pageSize", in: "query", required: false, description: "Items per page. Defaults to 12; maximum 50.", schema: { type: "integer", minimum: 1, maximum: 50, default: 12 } }
        ],
        responses: {
          "200": catalogResponse("Visible nonarchived products with the requested translation.", productCatalogPage),
          "400": catalogError("Unknown, repeated, or invalid query parameters."),
          "405": catalogError("Only GET is allowed."),
          "500": catalogError("Catalog data could not be loaded.")
        }
      }
    },
    "/api/v1/catalog/products/{slug}": {
      get: {
        summary: "Get a visible catalog product",
        parameters: [
          slugParameter,
          localeParameter
        ],
        responses: {
          "200": catalogResponse("Visible nonarchived product with its requested translation.", productCatalogItem),
          "400": catalogError("Unknown, repeated, or invalid query parameters."),
          "404": catalogError("The product is archived, missing, or lacks the requested translation."),
          "405": catalogError("Only GET is allowed."),
          "500": catalogError("Catalog data could not be loaded.")
        }
      }
    },
    "/api/v1/catalog/fulfillment-slots": {
      get: {
        summary: "List enabled fulfillment slots for a date",
        parameters: [dateParameter],
        responses: {
          "200": catalogResponse("Enabled slots with database-calculated cutoff state.", { type: "object", required: ["items"], properties: { items: { type: "array", items: fulfillmentSlot } } }),
          "400": catalogError("Unknown, repeated, or invalid query parameters."),
          "405": catalogError("Only GET is allowed."),
          "500": catalogError("Catalog data could not be loaded.")
        }
      }
    },
    "/api/v1/catalog/products/{slug}/availability": {
      get: {
        summary: "Get read-only product availability for a fulfillment slot",
        parameters: [slugParameter, localeParameter, dateParameter, slotKeyParameter],
        responses: {
          "200": catalogResponse("Raw available capacity: capacity minus reserved minus committed; absent inventory is zero and unconfigured.", availability),
          "400": catalogError("Unknown, repeated, or invalid query parameters."),
          "404": catalogError("The product is hidden, or the slot is disabled or unknown."),
          "405": catalogError("Only GET is allowed."),
          "500": catalogError("Catalog data could not be loaded.")
        }
      }
    },
    "/api/v1/health/live": {
      get: {
        summary: "Liveness check",
        responses: {
          "200": { description: "Process is live." }
        }
      }
    },
    "/api/v1/health/ready": {
      get: {
        summary: "Readiness check",
        responses: {
          "200": { description: "Database is reachable." },
          "503": { description: "Database is unavailable." }
        }
      }
    },
    "/api/v1/openapi.json": {
      get: {
        summary: "OpenAPI document",
        responses: {
          "200": { description: "Foundation API contract." }
        }
      }
    }
  }
  } as const;
}

const localeParameter = {
  name: "locale",
  in: "query",
  required: true,
  description: "Requested translation. No fallback is applied.",
  schema: { type: "string", enum: ["vi", "en"] }
};

const slugParameter = {
  name: "slug",
  in: "path",
  required: true,
  description: "Product slug.",
  schema: { type: "string", minLength: 1 }
};

const dateParameter = {
  name: "date",
  in: "query",
  required: true,
  description: "Business date in YYYY-MM-DD format.",
  schema: { type: "string", format: "date" }
};

const slotKeyParameter = {
  name: "slotKey",
  in: "query",
  required: true,
  description: "Enabled fulfillment slot key.",
  schema: { type: "string", minLength: 1 }
};

const productCatalogItem = {
  type: "object",
  required: ["slug", "name", "description", "unitPrice", "currency", "priceVersion", "acceptingOrders", "fulfillmentBlocked"],
  properties: {
    slug: { type: "string" }, name: { type: "string" }, description: { type: "string" },
    unitPrice: { type: "integer", minimum: 0 }, currency: { type: "string", example: "VND" },
    priceVersion: { type: "integer", minimum: 1 }, acceptingOrders: { type: "boolean", description: "False means the visible product is paused." },
    fulfillmentBlocked: { type: "boolean" }
  }
};

const productCatalogPage = {
  type: "object",
  required: ["items", "page", "pageSize", "total"],
  properties: { items: { type: "array", items: productCatalogItem }, page: { type: "integer" }, pageSize: { type: "integer" }, total: { type: "integer" } }
};

const fulfillmentSlot = {
  type: "object",
  required: ["slotKey", "label", "startLocalTime", "endLocalTime", "timezone", "cutoffMinutes", "cutoffAt", "cutoffPassed"],
  properties: {
    slotKey: { type: "string" }, label: { type: "string" }, startLocalTime: { type: "string" }, endLocalTime: { type: "string" },
    timezone: { type: "string" }, cutoffMinutes: { type: "integer", minimum: 0 }, cutoffAt: { type: "string", format: "date-time" }, cutoffPassed: { type: "boolean" }
  }
};

const availability = {
  type: "object",
  required: ["slug", "date", "slotKey", "availableQuantity", "inventoryConfigured", "fulfillmentBlocked", "acceptingOrders", "cutoffPassed"],
  properties: {
    slug: { type: "string" }, date: { type: "string", format: "date" }, slotKey: { type: "string" }, availableQuantity: { type: "integer", minimum: 0 },
    inventoryConfigured: { type: "boolean" }, fulfillmentBlocked: { type: "boolean" }, acceptingOrders: { type: "boolean" }, cutoffPassed: { type: "boolean" }
  }
};

const catalogError = (description: string) => ({ description });

const catalogResponse = (description: string, data: Record<string, unknown>) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["version", "data"],
        properties: { version: { type: "string", const: API_VERSION }, data }
      }
    }
  }
});

export const foundationOpenApiDocument = buildOpenApiDocument();
