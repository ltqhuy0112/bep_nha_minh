export type CartItem = {
  slug: string; name: string; quantity: number; unitPrice: number; currency: string;
  priceVersion: number; acceptingOrders: boolean; fulfillmentBlocked: boolean;
  availableQuantity: number | null;
};
export type Cart = {
  id: string | null; version: number; owner: "guest" | "account";
  businessDate: string | null; slotKey: string | null; items: CartItem[];
  totalQuantity: number; subtotal: number; limits: { perProduct: number; total: number };
  guestCart: Cart | null;
};
