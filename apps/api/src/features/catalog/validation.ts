export type CatalogLocale = "vi" | "en";

export type ProductListQuery = {
  locale: CatalogLocale;
  page: number;
  pageSize: number;
};

export type ProductQuery = { locale: CatalogLocale };
export type SlotsQuery = { date: string };
export type AvailabilityQuery = { locale: CatalogLocale; date: string; slotKey: string };

export class CatalogValidationError extends Error {}

export function parseProductListQuery(params: URLSearchParams): ProductListQuery {
  assertKnownSingleParameters(params, ["locale", "page", "pageSize"]);
  const pageSize = parseBoundedInteger(params.get("pageSize") ?? "12", "pageSize", 1, 50);
  return {
    locale: parseLocale(params),
    page: parseBoundedInteger(
      params.get("page") ?? "1",
      "page",
      1,
      Math.floor(Number.MAX_SAFE_INTEGER / pageSize)
    ),
    pageSize
  };
}

export function parseProductQuery(params: URLSearchParams): ProductQuery {
  assertKnownSingleParameters(params, ["locale"]);
  return { locale: parseLocale(params) };
}

export function parseSlotsQuery(params: URLSearchParams): SlotsQuery {
  assertKnownSingleParameters(params, ["date"]);
  return { date: parseDate(params.get("date"), "date") };
}

export function parseAvailabilityQuery(params: URLSearchParams): AvailabilityQuery {
  assertKnownSingleParameters(params, ["locale", "date", "slotKey"]);
  const slotKey = params.get("slotKey");
  if (!slotKey || slotKey.trim() !== slotKey) throw new CatalogValidationError("slotKey is required.");
  return { locale: parseLocale(params), date: parseDate(params.get("date"), "date"), slotKey };
}

function assertKnownSingleParameters(params: URLSearchParams, allowed: string[]) {
  const seen = new Set<string>();
  for (const [key] of params) {
    if (!allowed.includes(key) || seen.has(key)) {
      throw new CatalogValidationError("Invalid query parameters.");
    }
    seen.add(key);
  }
}

function parseLocale(params: URLSearchParams): CatalogLocale {
  const locale = params.get("locale");
  if (locale === "vi" || locale === "en") return locale;
  throw new CatalogValidationError("locale must be vi or en.");
}

function parseDate(value: string | null, name: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new CatalogValidationError(`${name} must be YYYY-MM-DD.`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new CatalogValidationError(`${name} must be a calendar date.`);
  }
  return value;
}

function parseBoundedInteger(value: string, name: string, minimum: number, maximum: number): number {
  if (!/^\d+$/.test(value)) throw new CatalogValidationError(`${name} must be an integer.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new CatalogValidationError(`${name} is out of range.`);
  }
  return parsed;
}
