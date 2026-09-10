export type ProductCatalogItem = {
  slug: string;
  name: string;
  description: string;
  unitPrice: number;
  currency: string;
  priceVersion: number;
  acceptingOrders: boolean;
  fulfillmentBlocked: boolean;
};

export type ProductCatalogPage = {
  items: ProductCatalogItem[];
  page: number;
  pageSize: number;
  total: number;
};

export type FulfillmentSlot = {
  slotKey: string;
  label: string;
  startLocalTime: string;
  endLocalTime: string;
  timezone: string;
  cutoffMinutes: number;
  cutoffAt: string;
  cutoffPassed: boolean;
};

export type Availability = {
  slug: string;
  date: string;
  slotKey: string;
  availableQuantity: number;
  inventoryConfigured: boolean;
  fulfillmentBlocked: boolean;
  acceptingOrders: boolean;
  cutoffPassed: boolean;
};
