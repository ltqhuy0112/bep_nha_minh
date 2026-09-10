import type { Locale } from "@bep-nha-minh/shared/constants/i18n";
import type {
  Availability,
  FulfillmentSlot,
  ProductCatalogItem,
  ProductCatalogPage
} from "@bep-nha-minh/shared/types/catalog";

export type CatalogProduct = ProductCatalogItem;
export type CatalogPage = ProductCatalogPage;
export type { Availability as ProductAvailability, FulfillmentSlot };

export type CatalogLocale = Locale;
