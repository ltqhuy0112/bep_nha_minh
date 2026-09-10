import type { ServerResponse } from "node:http";
import { errorEnvelope, successEnvelope } from "../../contracts/v1/envelope";
import { createCatalogRepository } from "./repository";
import {
  CatalogValidationError,
  parseAvailabilityQuery,
  parseProductListQuery,
  parseProductQuery,
  parseSlotsQuery
} from "./validation";
import type { CatalogDatabase } from "./database";

export async function handleCatalogRequest(
  pathname: string,
  method: string | undefined,
  searchParams: URLSearchParams,
  response: ServerResponse,
  database: CatalogDatabase
): Promise<boolean> {
  const match = pathname.match(/^\/api\/v1\/catalog\/products\/([^/]+)(\/availability)?$/);
  const isProducts = pathname === "/api/v1/catalog/products";
  const isSlots = pathname === "/api/v1/catalog/fulfillment-slots";
  if (!isProducts && !isSlots && !match) return false;
  if (method !== "GET") {
    sendJson(response, 405, errorEnvelope("METHOD_NOT_ALLOWED", "Method not allowed."), true);
    return true;
  }

  try {
    const repository = createCatalogRepository(database);
    if (isProducts) {
      sendJson(response, 200, successEnvelope(await repository.listProducts(parseProductListQuery(searchParams))));
      return true;
    }
    if (isSlots) {
      sendJson(response, 200, successEnvelope({ items: await repository.listSlots(parseSlotsQuery(searchParams).date) }));
      return true;
    }
    const slug = decodeURIComponent(match![1]);
    if (match![2]) {
      const query = parseAvailabilityQuery(searchParams);
      const lookup = await repository.getAvailability(slug, query.locale, query.date, query.slotKey);
      if (!lookup.productFound) sendJson(response, 404, errorEnvelope("PRODUCT_NOT_FOUND", "Catalog product not found."));
      else if (!lookup.slotFound) sendJson(response, 404, errorEnvelope("FULFILLMENT_SLOT_NOT_FOUND", "Fulfillment slot not found."));
      else sendJson(response, 200, successEnvelope(lookup.availability));
      return true;
    }
    const product = await repository.getProduct(slug, parseProductQuery(searchParams).locale);
    if (!product) sendJson(response, 404, errorEnvelope("PRODUCT_NOT_FOUND", "Catalog product not found."));
    else sendJson(response, 200, successEnvelope(product));
    return true;
  } catch (error) {
    if (error instanceof CatalogValidationError || error instanceof URIError) {
      sendJson(response, 400, errorEnvelope("VALIDATION_ERROR", "Invalid catalog request."));
      return true;
    }
    throw error;
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown, allowGet = false) {
  if (allowGet) response.setHeader("Allow", "GET");
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}
