"use client";

import Image from "next/image";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { Cart } from "@bep-nha-minh/shared/types/cart";
import { formatPrice, getProductPresentation } from "@/features/catalog/presentation";
import { cartCopy } from "../copy";
import type { CartItem, CartLocale } from "../types";

export function CartLineItem({ cart, item, locale, busy, onQuantity }: { cart: Cart; item: CartItem; locale: CartLocale; busy: boolean; onQuantity: (quantity: number) => void }) {
  const text = cartCopy(locale);
  const presentation = getProductPresentation(item.slug, locale);
  const maximumQuantity = Math.min(cart.limits.perProduct, cart.limits.total - cart.totalQuantity + item.quantity);
  return <article className="flex gap-4 py-5"><div className="relative size-24 shrink-0 overflow-hidden rounded-md bg-beige-200 sm:size-28"><Image src={presentation.image} alt={presentation.alt} fill sizes="112px" className="object-cover" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-serif text-xl text-olive-900">{item.name}</h2><p className="mt-1 text-sm font-bold text-wood-500">{formatPrice(item.unitPrice, item.currency, locale)}</p></div><button type="button" title={text.remove} aria-label={text.remove} disabled={busy} onClick={() => onQuantity(0)} className="flex size-11 items-center justify-center rounded-md border border-olive-700/15 text-red-800 disabled:opacity-50"><Trash2 size={17} /></button></div>{!item.acceptingOrders ? <p className="mt-2 text-xs font-semibold text-wood-500">{text.unavailable}</p> : null}{item.fulfillmentBlocked ? <p className="mt-2 text-xs font-semibold text-wood-500">{text.blocked}</p> : null}{item.availableQuantity !== null ? <p className="mt-2 text-xs text-muted">{text.available.replace("{count}", String(item.availableQuantity))}</p> : null}<div className="mt-4 flex items-center justify-between gap-3"><span className="text-sm font-semibold">{text.quantity}</span><div className="flex h-11 items-center rounded-md border border-olive-700/15"><button type="button" aria-label={`${text.quantity} -`} disabled={busy || item.quantity <= 1} onClick={() => onQuantity(item.quantity - 1)} className="grid size-10 place-items-center disabled:opacity-40"><Minus size={16} /></button><span className="grid w-9 place-items-center text-sm font-bold">{item.quantity}</span><button type="button" aria-label={`${text.quantity} +`} disabled={busy || item.quantity >= maximumQuantity} onClick={() => onQuantity(item.quantity + 1)} className="grid size-10 place-items-center disabled:opacity-40"><Plus size={16} /></button></div></div></div></article>;
}
