"use client";

import type { Cart } from "@bep-nha-minh/shared/types/cart";
import type { CartLocale } from "../types";
import { CartLineItem } from "./cart-line-item";

export function GuestCartSummary({ cart, locale, busy, onQuantity }: { cart: Cart; locale: CartLocale; busy: boolean; onQuantity: (slug: string, quantity: number) => void }) {
  const title = locale === "vi" ? "Món trong giỏ khách" : "Items in guest cart";
  if (!cart.items.length) return null;
  return <section className="mt-6 border-t border-olive-700/15 pt-5"><h3 className="font-serif text-xl text-olive-900">{title}</h3><div className="mt-3 divide-y divide-olive-700/15 border-y border-olive-700/15">{cart.items.map((item) => <CartLineItem key={item.slug} cart={cart} item={item} locale={locale} busy={busy} onQuantity={(quantity) => onQuantity(item.slug, quantity)} />)}</div></section>;
}
