"use client";

import { useEffect, useRef, useState } from "react";
import {
  CatalogRequestError,
  getAvailability,
  getFulfillmentSlots,
  getProduct,
  getProducts
} from "../services/catalog-client";
import type {
  CatalogLocale,
  CatalogPage,
  CatalogProduct,
  FulfillmentSlot,
  ProductAvailability
} from "../types";

type LoadState<T> = { data: T | null; error: CatalogRequestError | null; key: string };
const initialState = <T,>(): LoadState<T> => ({ data: null, error: null, key: "" });

export function useCatalogProducts(locale: CatalogLocale, page: number) {
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<LoadState<CatalogPage>>(initialState);
  const requestId = useRef(0);
  const requestKey = `${locale}:${page}:${refresh}`;
  useEffect(() => {
    const controller = new AbortController();
    const activeRequest = ++requestId.current;
    void getProducts(locale, page, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted && activeRequest === requestId.current) setState({ data, error: null, key: requestKey });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || activeRequest !== requestId.current) return;
        setState({ data: null, error: toRequestError(error), key: requestKey });
      });
    return () => controller.abort();
  }, [locale, page, requestKey]);
  const isCurrentRequest = state.key === requestKey;
  return { data: isCurrentRequest ? state.data : null, loading: !isCurrentRequest, error: isCurrentRequest ? state.error : null, retry: () => setRefresh((value) => value + 1) };
}

export function useCatalogProduct(slug: string, locale: CatalogLocale) {
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<LoadState<CatalogProduct>>(initialState);
  const requestId = useRef(0);
  const requestKey = `${slug}:${locale}:${refresh}`;
  useEffect(() => {
    const controller = new AbortController();
    const activeRequest = ++requestId.current;
    void getProduct(slug, locale, controller.signal)
      .then((data) => { if (!controller.signal.aborted && activeRequest === requestId.current) setState({ data, error: null, key: requestKey }); })
      .catch((error: unknown) => {
        if (controller.signal.aborted || activeRequest !== requestId.current) return;
        setState({ data: null, error: toRequestError(error), key: requestKey });
      });
    return () => controller.abort();
  }, [slug, locale, requestKey]);
  const isCurrentRequest = state.key === requestKey;
  return { data: isCurrentRequest ? state.data : null, loading: !isCurrentRequest, error: isCurrentRequest ? state.error : null, retry: () => setRefresh((value) => value + 1) };
}

export function useFulfillmentSlots(date: string | null) {
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<LoadState<{ items: FulfillmentSlot[] }>>(initialState);
  const requestId = useRef(0);
  const requestKey = `${date ?? ""}:${refresh}`;
  useEffect(() => {
    const activeRequest = ++requestId.current;
    if (!date) {
      return;
    }
    const controller = new AbortController();
    void getFulfillmentSlots(date, controller.signal)
      .then((data) => { if (!controller.signal.aborted && activeRequest === requestId.current) setState({ data, error: null, key: requestKey }); })
      .catch((error: unknown) => {
        if (controller.signal.aborted || activeRequest !== requestId.current) return;
        setState({ data: null, error: toRequestError(error), key: requestKey });
      });
    return () => controller.abort();
  }, [date, requestKey]);
  const isCurrentRequest = state.key === requestKey;
  return { data: date && isCurrentRequest ? state.data : null, loading: Boolean(date) && !isCurrentRequest, error: date && isCurrentRequest ? state.error : null, retry: () => setRefresh((value) => value + 1) };
}

export function useAvailability(slug: string, locale: CatalogLocale, date: string | null, slotKey: string | null) {
  const [refresh, setRefresh] = useState(0);
  const requestKey = `${slug}:${locale}:${date ?? ""}:${slotKey ?? ""}`;
  const [state, setState] = useState<LoadState<ProductAvailability>>(initialState);
  const requestId = useRef(0);
  useEffect(() => {
    const activeRequest = ++requestId.current;
    if (!date || !slotKey) {
      return;
    }
    const controller = new AbortController();
    void getAvailability(slug, locale, date, slotKey, controller.signal)
      .then((data) => { if (!controller.signal.aborted && activeRequest === requestId.current) setState({ data, error: null, key: requestKey }); })
      .catch((error: unknown) => {
        if (controller.signal.aborted || activeRequest !== requestId.current) return;
        setState({ data: null, error: toRequestError(error), key: requestKey });
      });
    return () => controller.abort();
  }, [slug, locale, date, slotKey, requestKey, refresh]);
  const isCurrentRequest = state.key === requestKey;
  return {
    data: isCurrentRequest ? state.data : null,
    loading: !isCurrentRequest && Boolean(date && slotKey),
    error: isCurrentRequest ? state.error : null,
    retry: () => setRefresh((value) => value + 1)
  };
}

function toRequestError(error: unknown) {
  return error instanceof CatalogRequestError ? error : new CatalogRequestError(502);
}
