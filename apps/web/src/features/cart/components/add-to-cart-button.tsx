"use client";

import Link from "next/link";
import { Plus, RotateCw } from "lucide-react";
import { useState } from "react";
import { CartRequestError, getCart, initializeCart, setCartItem } from "../services/cart-client";
import type { CartLocale } from "../types";

export function AddToCartButton({ locale, slug, className = "", disabled = false }: { locale: CartLocale; slug: string; className?: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"success" | CartRequestError | null>(null);
  const text = locale === "vi" ? { add: "Thêm vào giỏ", retry: "Thử lại", success: "Đã thêm vào giỏ.", view: "Xem giỏ hàng", error: "Không thể thêm món. Vui lòng thử lại." } : { add: "Add to cart", retry: "Retry", success: "Added to cart.", view: "View cart", error: "We could not add this item. Please try again." };
  async function add() {
    setBusy(true); setResult(null);
    try {
      let cart = await getCart(locale);
      if (!cart.id) { await initializeCart(locale); cart = await getCart(locale); }
      const existing = cart.items.find((item) => item.slug === slug);
      await setCartItem(locale, slug, (existing?.quantity ?? 0) + 1, cart.version);
      setResult("success");
    } catch (error) { setResult(error instanceof CartRequestError ? error : new CartRequestError(0)); }
    finally { setBusy(false); }
  }
  return <span className="inline-flex flex-wrap items-center gap-2"><button type="button" disabled={busy || disabled} onClick={() => void add()} className={`inline-flex min-h-11 items-center gap-2 rounded-md bg-olive-700 px-4 text-sm font-semibold text-white disabled:opacity-50 ${className}`}><Plus size={17} />{text.add}</button>{result === "success" ? <span role="status" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-olive-900">{text.success}<Link href={`/${locale}/cart`} className="underline underline-offset-4">{text.view}</Link></span> : null}{result instanceof CartRequestError ? <span role="alert" className="inline-flex flex-wrap items-center gap-2 text-sm font-semibold text-red-800">{text.error}<button type="button" disabled={busy || disabled} onClick={() => void add()} className="inline-flex min-h-11 items-center gap-2 underline underline-offset-4 disabled:opacity-50"><RotateCw size={16} />{text.retry}</button></span> : null}</span>;
}
