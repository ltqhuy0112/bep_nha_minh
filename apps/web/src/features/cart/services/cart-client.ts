import type { Cart } from "@bep-nha-minh/shared/types/cart";
import type { CartLocale, CartSlot } from "../types";

type Envelope<T> = { data: T; version?: string };
type CartAction =
  | { action: "initialize"; locale: CartLocale }
  | { action: "set-item"; slug: string; quantity: number; expectedVersion: number; locale: CartLocale; source?: "guest" | "account" }
  | { action: "set-slot"; businessDate: string; slotKey: string; expectedVersion: number; locale: CartLocale }
  | { action: "merge"; expectedVersion: number; guestVersion: number; locale: CartLocale; slotSource?: "guest" | "account" };

export class CartRequestError extends Error {
  constructor(readonly status: number, readonly code?: string) { super("Cart request failed."); }
}

const initializeInFlight: Partial<Record<CartLocale, Promise<Cart>>> = {};

export function getCart(locale: CartLocale, signal?: AbortSignal) {
  return request<Cart>(`/api/cart?${new URLSearchParams({ locale })}`, { signal });
}

export function initializeCart(locale: CartLocale) {
  const current = initializeInFlight[locale];
  if (current) return current;
  const request = mutate({ action: "initialize", locale });
  initializeInFlight[locale] = request;
  const clear = () => { if (initializeInFlight[locale] === request) delete initializeInFlight[locale]; };
  void request.then(clear, clear);
  return request;
}
export function setCartItem(locale: CartLocale, slug: string, quantity: number, expectedVersion: number, source?: "guest" | "account") {
  return mutate({ action: "set-item", locale, slug, quantity, expectedVersion, source });
}
export function setCartSlot(locale: CartLocale, businessDate: string, slotKey: string, expectedVersion: number) {
  return mutate({ action: "set-slot", locale, businessDate, slotKey, expectedVersion });
}
export function mergeCart(locale: CartLocale, expectedVersion: number, guestVersion: number, slotSource?: "guest" | "account") {
  return mutate({ action: "merge", locale, expectedVersion, guestVersion, slotSource });
}

export async function getCartSlots(date: string, signal?: AbortSignal) {
  return request<{ items: CartSlot[] }>(`/api/catalog/fulfillment-slots?${new URLSearchParams({ date })}`, { signal });
}

async function mutate(action: CartAction) {
  return request<Cart>("/api/cart", { method: "POST", body: JSON.stringify(action) });
}

async function request<T>(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const abort = () => controller.abort();
  init.signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(url, { ...init, cache: "no-store", credentials: "same-origin", signal: controller.signal, headers: { "content-type": "application/json", ...init.headers } });
    const body = await response.json().catch(() => null) as (Envelope<T> & { error?: { code?: string } }) | null;
    if (!response.ok) throw new CartRequestError(response.status, body?.error?.code);
    return body?.data ?? (body as T);
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abort);
  }
}
