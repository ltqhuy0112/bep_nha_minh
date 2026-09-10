"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerAddress } from "@bep-nha-minh/shared/schemas/customer-address";
import { authPath } from "../customer-auth/routes";
import type { Locale } from "../customer-auth/types";
import { AddressRequestError, listAddresses } from "./service";
import { addressCopy } from "./copy";

export function useAddresses(locale: Locale) {
  const router = useRouter();
  const text = addressCopy[locale];
  const [items, setItems] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(false);
  const mutating = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    // Deferral lets StrictMode discard its first subscription before starting I/O.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void listAddresses(controller.signal).then((result) => {
        if (!controller.signal.aborted) setItems(result.items);
      }).catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof AddressRequestError && cause.status === 401) router.replace(authPath(locale, "login", `/${locale}/account/addresses`));
        else setError(text.failed);
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    });
    return () => controller.abort();
  }, [locale, router, text.failed, attempt]);

  function reload() { setError(null); setLoading(true); setAttempt((value) => value + 1); }
  async function mutate(operation: () => Promise<unknown>, success: string) {
    if (mutating.current) return false;
    mutating.current = true;
    setBusy(true); setError(null); setMessage(null);
    try {
      await operation();
      if (!alive.current) return false;
      setMessage(success); reload();
      return true;
    } catch (cause) {
      if (!alive.current) return false;
      if (cause instanceof AddressRequestError && cause.status === 401) router.replace(authPath(locale, "login", `/${locale}/account/addresses`));
      else setError(cause instanceof AddressRequestError && cause.status === 429 ? text.rate : text.failed);
      return false;
    } finally { mutating.current = false; if (alive.current) setBusy(false); }
  }
  return { items, loading, busy, error, message, text, reload, mutate };
}
