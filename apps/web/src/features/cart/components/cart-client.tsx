"use client";

import Link from "next/link";
import { RotateCw, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import type { Cart } from "@bep-nha-minh/shared/types/cart";
import { authPath } from "@/features/customer-auth/routes";
import { formatPrice } from "@/features/catalog/presentation";
import { cartCopy } from "../copy";
import { useCart } from "../hooks/use-cart";
import { getCartSlots } from "../services/cart-client";
import type { CartLocale, CartSlot } from "../types";
import { CartLineItem } from "./cart-line-item";
import { GuestCartSummary } from "./guest-cart-summary";

export function CartClient({ locale }: { locale: CartLocale }) {
  const text = cartCopy(locale);
  const state = useCart(locale);
  const [slotState, setSlotState] = useState<{ date: string; slots: CartSlot[] | null; error: boolean } | null>(null);
  const [slotSource, setSlotSource] = useState<"guest" | "account" | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const date = selectedDate ?? state.cart?.businessDate ?? businessDate();

  useEffect(() => {
    const controller = new AbortController();
    void getCartSlots(date, controller.signal).then((result) => {
      if (!controller.signal.aborted) setSlotState({ date, slots: result.items, error: false });
    }).catch(() => { if (!controller.signal.aborted) setSlotState({ date, slots: null, error: true }); });
    return () => controller.abort();
  }, [date]);

  if (state.loading) return <CartState locale={locale} message={text.loading} />;
  if (state.error && !state.cart) return <CartState locale={locale} message={text.error} retry={state.reload} unauthenticated={state.error.status === 401} />;
  if (!state.cart) return null;
  const cart = state.cart;
  const slots = slotState?.date === date ? slotState.slots : null;
  const slotsError = slotState?.date === date && slotState.error;

  return <main className="botanical-section botanical-soft min-h-[calc(100vh-10rem)] py-10 sm:py-14"><div className="mx-auto max-w-6xl px-5">
    <Link href={`/${locale}/menu`} className="inline-flex min-h-11 items-center text-sm font-bold text-olive-900 underline decoration-olive-500/50 underline-offset-4">{text.back}</Link>
    <div className="mt-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-wood-500">{text.cartLabel}</p><h1 className="font-serif text-4xl text-olive-900 sm:text-5xl">{text.title}</h1></div>{cart.totalQuantity ? <p className="text-sm font-semibold text-muted">{cart.totalQuantity} {text.items}</p> : null}</div>
    {state.error ? <CartError locale={locale} error={state.error} retry={state.reload} /> : null}
    {cart.owner === "account" && cart.guestCart ? <GuestMerge locale={locale} cart={cart} guestCart={cart.guestCart} busy={state.busy} slotSource={slotSource} onSlotSource={setSlotSource} onMerge={() => void state.merge(slotSource ?? undefined)} onGuestQuantity={(slug, quantity) => void state.setGuestItem(slug, quantity)} /> : null}
    {!cart.items.length ? <EmptyCart locale={locale} /> : <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"><section className="divide-y divide-olive-700/15 border-y border-olive-700/15">{cart.items.map((item) => <CartLineItem key={item.slug} cart={cart} item={item} locale={locale} busy={state.busy} onQuantity={(quantity) => void state.setItem(item.slug, quantity)} />)}</section><Delivery locale={locale} cart={cart} date={date} slots={slots} slotsError={slotsError} busy={state.busy} onDate={setSelectedDate} onSlot={(slotKey) => void state.setSlot(date, slotKey)} /></div>}
  </div></main>;
}

function GuestMerge({ locale, cart, guestCart, busy, slotSource, onSlotSource, onMerge, onGuestQuantity }: { locale: CartLocale; cart: Cart; guestCart: Cart; busy: boolean; slotSource: "guest" | "account" | null; onSlotSource: (value: "guest" | "account") => void; onMerge: () => void; onGuestQuantity: (slug: string, quantity: number) => void }) {
  const text = cartCopy(locale);
  const conflict = Boolean(cart.businessDate && cart.slotKey && guestCart.businessDate && guestCart.slotKey && (cart.businessDate !== guestCart.businessDate || cart.slotKey !== guestCart.slotKey));
  return <section className="mt-8 border-y border-olive-700/15 py-6"><h2 className="font-serif text-2xl text-olive-900">{text.mergeTitle}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{text.mergeBody}</p><Link href={authPath(locale, "login", `/${locale}/cart`)} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">{locale === "vi" ? "Đăng nhập" : "Sign in"}</Link><GuestCartSummary cart={guestCart} locale={locale} busy={busy} onQuantity={onGuestQuantity} />{conflict ? <div className="mt-4"><p className="text-sm font-semibold">{text.chooseSlot}</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" aria-pressed={slotSource === "guest"} onClick={() => onSlotSource("guest")} className={choiceClass(slotSource === "guest")}>{text.keepGuest}</button><button type="button" aria-pressed={slotSource === "account"} onClick={() => onSlotSource("account")} className={choiceClass(slotSource === "account")}>{text.keepAccount}</button></div></div> : null}<button type="button" disabled={busy || Boolean(conflict && !slotSource)} onClick={onMerge} className="mt-5 inline-flex min-h-11 items-center rounded-md bg-olive-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{text.merge}</button></section>;
}

function Delivery({ locale, cart, date, slots, slotsError, busy, onDate, onSlot }: { locale: CartLocale; cart: Cart; date: string; slots: CartSlot[] | null; slotsError: boolean; busy: boolean; onDate: (value: string) => void; onSlot: (slotKey: string) => void }) { const text = cartCopy(locale); return <aside className="border border-olive-700/15 bg-white p-5"><h2 className="font-serif text-2xl text-olive-900">{text.delivery}</h2><label className="mt-5 block text-sm font-bold" htmlFor="cart-date">{text.date}</label><input id="cart-date" type="date" value={date} disabled={busy} onChange={(event) => onDate(event.target.value)} className="filter-control mt-2 w-full" />{slotsError ? <p className="mt-4 text-sm text-red-800">{text.error}</p> : null}{slots === null ? <p className="mt-4 text-sm text-muted">{text.slotsLoading}</p> : slots.length === 0 ? <p className="mt-4 text-sm text-muted">{text.slotsEmpty}</p> : <><p className="mt-5 text-sm font-bold">{text.slot}</p><div className="mt-3 grid gap-2">{slots.map((slot) => <button key={slot.slotKey} type="button" disabled={busy || slot.cutoffPassed} aria-pressed={cart.businessDate === date && cart.slotKey === slot.slotKey} onClick={() => onSlot(slot.slotKey)} className={choiceClass(cart.businessDate === date && cart.slotKey === slot.slotKey)}><span className="block">{slot.label}</span><span className="mt-1 block text-xs font-normal">{slot.startLocalTime} - {slot.endLocalTime}</span></button>)}</div></>}<div className="mt-6 border-t border-olive-700/15 pt-5"><div className="flex justify-between gap-3 text-sm"><span>{text.subtotal}</span><strong>{formatPrice(cart.subtotal, cart.items[0]?.currency ?? "VND", locale)}</strong></div><button type="button" disabled className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-olive-700 px-4 text-sm font-semibold text-white opacity-50">{text.checkout} <span className="ml-2 text-xs">{text.soon}</span></button><p className="mt-2 text-center text-xs text-muted">{locale === "vi" ? "Chưa mở nhận đơn." : "Orders are not open yet."}</p></div></aside>; }
function EmptyCart({ locale }: { locale: CartLocale }) { const text = cartCopy(locale); return <section className="mt-10 flex flex-col items-center border-y border-olive-700/15 py-16 text-center"><ShoppingBag size={34} strokeWidth={1.5} /><p className="mt-4 text-sm text-muted">{text.empty}</p><Link href={`/${locale}/menu`} className="mt-6 inline-flex min-h-11 items-center rounded-md bg-olive-700 px-4 text-sm font-semibold text-white">{text.continueMenu}</Link></section>; }
function CartState({ locale, message, retry, unauthenticated = false }: { locale: CartLocale; message: string; retry?: () => Promise<unknown>; unauthenticated?: boolean }) { const text = cartCopy(locale); return <main className="min-h-[calc(100vh-10rem)] py-14"><div className="mx-auto max-w-6xl px-5"><p className="text-sm font-semibold text-muted">{message}</p>{unauthenticated ? <Link href={authPath(locale, "login", `/${locale}/cart`)} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">{locale === "vi" ? "Đăng nhập" : "Sign in"}</Link> : null}{retry ? <button type="button" onClick={() => void retry()} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4"><RotateCw size={16} />{text.retry}</button> : null}</div></main>; }
function CartError({ locale, error, retry }: { locale: CartLocale; error: { status: number; code?: string }; retry: () => Promise<unknown> }) { const text = cartCopy(locale); return <div className="mt-5 flex flex-wrap items-center gap-3" role="alert"><p className="text-sm font-semibold text-red-800">{errorMessage(error, text)}</p><button type="button" onClick={() => void retry()} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4"><RotateCw size={16} />{text.retry}</button></div>; }
function choiceClass(selected: boolean) { return `min-h-11 rounded-md border px-3 py-2 text-left text-sm font-semibold transition disabled:opacity-50 ${selected ? "border-olive-700 bg-olive-700 text-cream-100" : "border-olive-700/15 bg-white text-olive-900 hover:border-olive-700/45"}`; }
function businessDate() { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value; return `${value("year")}-${value("month")}-${value("day")}`; }
function errorMessage(error: { status: number; code?: string }, text: ReturnType<typeof cartCopy>) { if (error.code === "CART_QUANTITY_LIMIT" || error.code === "AMOUNT_LIMIT") return text.limit; if (error.code === "PRODUCT_UNAVAILABLE" || error.code === "SLOT_UNAVAILABLE" || error.code === "CART_EXPIRED") return text.unavailableError; if (error.status === 409 || error.code === "CART_SLOT_CONFLICT" || error.code === "CART_VERSION_CONFLICT") return text.conflict; return text.error; }
