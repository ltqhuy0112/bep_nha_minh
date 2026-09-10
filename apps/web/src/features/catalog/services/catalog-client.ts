import type {
  CatalogLocale,
  CatalogPage,
  CatalogProduct,
  FulfillmentSlot,
  ProductAvailability
} from "../types";

type ApiEnvelope<T> = { data: T };

export class CatalogRequestError extends Error {
  constructor(readonly status: number) {
    super("Catalog request failed.");
  }
}

export async function getProducts(locale: CatalogLocale, page: number, signal: AbortSignal) {
  const query = new URLSearchParams({ locale, page: String(page), pageSize: "12" });
  return request<CatalogPage>(`/api/catalog/products?${query}`, signal);
}

export async function getProduct(slug: string, locale: CatalogLocale, signal: AbortSignal) {
  return request<CatalogProduct>(`/api/catalog/products/${encodeURIComponent(slug)}?locale=${locale}`, signal);
}

export async function getFulfillmentSlots(date: string, signal: AbortSignal) {
  return request<{ items: FulfillmentSlot[] }>(`/api/catalog/fulfillment-slots?date=${date}`, signal);
}

export async function getAvailability(
  slug: string,
  locale: CatalogLocale,
  date: string,
  slotKey: string,
  signal: AbortSignal
) {
  const query = new URLSearchParams({ locale, date, slotKey });
  return request<ProductAvailability>(`/api/catalog/products/${encodeURIComponent(slug)}/availability?${query}`, signal);
}

async function request<T>(url: string, signal: AbortSignal) {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) {
    throw new CatalogRequestError(response.status);
  }
  return (await response.json() as ApiEnvelope<T>).data;
}
