"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Cart } from "@bep-nha-minh/shared/types/cart";
import { CartRequestError, getCart, initializeCart, mergeCart, setCartItem, setCartSlot } from "../services/cart-client";
import type { CartLocale } from "../types";

export function useCart(locale: CartLocale) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CartRequestError | null>(null);
  const generation = useRef(0);
  const busyRef = useRef(false);
  const requestController = useRef<AbortController | null>(null);

  const reload = useCallback(async (preserveError = false) => {
    const currentGeneration = ++generation.current;
    requestController.current?.abort();
    setLoading(true); if (!preserveError) setError(null);
    const controller = new AbortController();
    requestController.current = controller;
    try {
      let next = await getCart(locale, controller.signal);
      if (!next.id) {
        await initializeCart(locale);
        next = await getCart(locale, controller.signal);
      }
      if (generation.current === currentGeneration) setCart(next);
    } catch (reason) {
      const requestError = reason instanceof CartRequestError ? reason : new CartRequestError(0);
      if (generation.current === currentGeneration) {
        if (requestError.status === 401) setCart(null);
        setError(requestError);
      }
    } finally {
      if (requestController.current === controller) requestController.current = null;
      if (generation.current === currentGeneration) setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    const timer = setTimeout(() => { void reload(); }, 0);
    return () => { clearTimeout(timer); generation.current += 1; requestController.current?.abort(); };
  }, [reload]);

  const mutate = useCallback(async (operation: (current: Cart) => Promise<Cart>) => {
    if (!cart || busyRef.current) return false;
    busyRef.current = true;
    setBusy(true); setError(null);
    try { setCart(await operation(cart)); return true; }
    catch (reason) {
      const requestError = reason instanceof CartRequestError ? reason : new CartRequestError(0);
      if (requestError.status === 401) setCart(null);
      setError(requestError);
      if (requestError.status === 409) void reload(true);
      return false;
    } finally { busyRef.current = false; setBusy(false); }
  }, [cart, reload]);

  return {
    cart, loading, busy, error, reload,
    setItem: (slug: string, quantity: number) => mutate((current) => setCartItem(locale, slug, quantity, current.version)),
    setGuestItem: (slug: string, quantity: number) => mutate((current) => setCartItem(locale, slug, quantity, current.guestCart?.version ?? 0, "guest")),
    setSlot: (businessDate: string, slotKey: string) => mutate((current) => setCartSlot(locale, businessDate, slotKey, current.version)),
    merge: (slotSource?: "guest" | "account") => mutate((current) => mergeCart(locale, current.version, current.guestCart?.version ?? 0, slotSource))
  };
}
