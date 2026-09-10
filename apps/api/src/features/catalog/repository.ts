import type {
  Availability,
  FulfillmentSlot,
  ProductCatalogItem,
  ProductCatalogPage
} from "@bep-nha-minh/shared/types/catalog";
import type { CatalogDatabase } from "./database";
import type { CatalogLocale, ProductListQuery } from "./validation";

type ProductRow = ProductCatalogItem;

type SlotRow = Omit<FulfillmentSlot, "cutoffAt"> & { cutoffAt: string | Date };

type AvailabilityRow = Availability & { productFound: boolean; slotFound: boolean };

export type AvailabilityLookup = {
  productFound: boolean;
  slotFound: boolean;
  availability: Availability | null;
};

export function createCatalogRepository(database: CatalogDatabase) {
  return {
    async listProducts(query: ProductListQuery): Promise<ProductCatalogPage> {
      const offset = (query.page - 1) * query.pageSize;
      const [items, total] = await Promise.all([
        database.query<ProductRow>(`
          SELECT p.slug, t.name, t.description, p.unit_price AS "unitPrice", p.currency,
            p.price_version AS "priceVersion", p.accepting_orders AS "acceptingOrders",
            p.fulfillment_blocked AS "fulfillmentBlocked"
          FROM products p
          JOIN product_translations t ON t.product_id = p.id AND t.locale = $1
          WHERE p.archived_at IS NULL
          ORDER BY p.slug
          LIMIT $2 OFFSET $3`, [query.locale, query.pageSize, offset]),
        database.query<{ total: number | string }>(`
          SELECT count(*)::int AS total
          FROM products p
          JOIN product_translations t ON t.product_id = p.id AND t.locale = $1
          WHERE p.archived_at IS NULL`, [query.locale])
      ]);
      return { items: items.rows, page: query.page, pageSize: query.pageSize, total: Number(total.rows[0]?.total ?? 0) };
    },

    async getProduct(slug: string, locale: CatalogLocale): Promise<ProductCatalogItem | null> {
      const result = await database.query<ProductRow>(`
        SELECT p.slug, t.name, t.description, p.unit_price AS "unitPrice", p.currency,
          p.price_version AS "priceVersion", p.accepting_orders AS "acceptingOrders",
          p.fulfillment_blocked AS "fulfillmentBlocked"
        FROM products p
        JOIN product_translations t ON t.product_id = p.id AND t.locale = $2
        WHERE p.slug = $1 AND p.archived_at IS NULL`, [slug, locale]);
      return result.rows[0] ?? null;
    },

    async listSlots(date: string): Promise<FulfillmentSlot[]> {
      const result = await database.query<SlotRow>(`
        SELECT fs.slot_key AS "slotKey", fs.label, fs.start_local_time::text AS "startLocalTime",
          fs.end_local_time::text AS "endLocalTime", fs.timezone, fs.cutoff_minutes AS "cutoffMinutes",
          (($1::date + fs.start_local_time) AT TIME ZONE fs.timezone)
            - make_interval(mins => fs.cutoff_minutes) AS "cutoffAt",
          ((($1::date + fs.start_local_time) AT TIME ZONE fs.timezone)
            - make_interval(mins => fs.cutoff_minutes)) <= CURRENT_TIMESTAMP AS "cutoffPassed"
        FROM fulfillment_slots fs
        WHERE fs.enabled
        ORDER BY fs.sort_order, fs.slot_key`, [date]);
      return result.rows.map((row) => ({ ...row, cutoffAt: toIsoDateTime(row.cutoffAt) }));
    },

    async getAvailability(
      slug: string,
      locale: CatalogLocale,
      date: string,
      slotKey: string
    ): Promise<AvailabilityLookup> {
      const result = await database.query<AvailabilityRow>(`
        WITH visible_product AS (
          SELECT p.id, p.slug, p.accepting_orders, p.fulfillment_blocked
          FROM products p
          JOIN product_translations t ON t.product_id = p.id AND t.locale = $2
          WHERE p.slug = $1 AND p.archived_at IS NULL
        ), enabled_slot AS (
          SELECT slot_key, start_local_time, timezone, cutoff_minutes
          FROM fulfillment_slots
          WHERE slot_key = $4 AND enabled
        )
        SELECT p.id IS NOT NULL AS "productFound", fs.slot_key IS NOT NULL AS "slotFound",
          p.slug, $3::date::text AS date, fs.slot_key AS "slotKey",
          COALESCE(inventory.capacity - inventory.reserved - inventory.committed, 0) AS "availableQuantity",
          inventory.id IS NOT NULL AS "inventoryConfigured",
          p.fulfillment_blocked AS "fulfillmentBlocked", p.accepting_orders AS "acceptingOrders",
          ((($3::date + fs.start_local_time) AT TIME ZONE fs.timezone)
            - make_interval(mins => fs.cutoff_minutes)) <= CURRENT_TIMESTAMP AS "cutoffPassed"
        FROM (SELECT 1) marker
        LEFT JOIN visible_product p ON true
        LEFT JOIN enabled_slot fs ON true
        LEFT JOIN inventory_slots inventory ON inventory.product_id = p.id
          AND inventory.business_date = $3::date AND inventory.slot_key = fs.slot_key`, [slug, locale, date, slotKey]);
      const row = result.rows[0];
      if (!row || !row.productFound || !row.slotFound) {
        return { productFound: Boolean(row?.productFound), slotFound: Boolean(row?.slotFound), availability: null };
      }
      const { productFound: _productFound, slotFound: _slotFound, ...availability } = row;
      return { productFound: true, slotFound: true, availability };
    }
  };
}

function toIsoDateTime(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
