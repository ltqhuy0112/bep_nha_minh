"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { copyFor } from "./copy";
import { loadInitialAuth, getSession, postCustomerAuth } from "./service";
import type { AuthConfig, AuthMode, CustomerSession, Locale } from "./types";
import { authPath, consumeOAuthReturn, safeReturnTo } from "./routes";

const tokenModes = new Set<AuthMode>(["reset-password", "verify-email"]);

export function useCustomerAuth(locale: Locale, initialMode: AuthMode = "login", returnTo?: string) {
  const router = useRouter();
  const text = copyFor(locale);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [ready, setReady] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const action = useRef<{ id: number; controller: AbortController } | null>(null);
  const fragmentRef = useRef<string | null>(null);

  useEffect(() => () => action.current?.controller.abort(), []);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const fragmentToken = fragment.get("token");
    if (fragmentToken) {
      fragmentRef.current = /^[A-Za-z0-9_-]{43}$/.test(fragmentToken) ? fragmentToken : null;
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }

    queueMicrotask(() => {
      if (!active) return;
      if (query.get("oauth") === "error") setError(text.oauthError);
      if (fragmentRef.current) setToken(fragmentRef.current);
      if (query.get("result") === "success") setMessage(text.genericAccepted);
      if (query.get("result") === "signed-out") setMessage(text.signedOut);
    });

    void loadInitialAuth().then(({ config: nextConfig, session: nextSession }) => {
      if (active) {
        setConfig(nextConfig);
        setSession(nextSession);
        setReady(true);
      }
    }).catch(() => {
      if (active) {
        setError(text.requestFailed);
        setReady(true);
      }
    });

    return () => {
      active = false;
    };
  }, [text.oauthError, text.requestFailed, text.genericAccepted, text.signedOut, loadAttempt]);

  function retryLoad() {
    setError(null);
    setReady(false);
    setLoadAttempt((attempt) => attempt + 1);
  }

  function startAction() {
    action.current?.controller.abort();
    const next = { id: (action.current?.id ?? 0) + 1, controller: new AbortController() };
    action.current = next;
    setBusy(true);
    return next;
  }

  function finishAction(current: { id: number; controller: AbortController }) {
    if (action.current?.id === current.id) setBusy(false);
  }

  function changeMode(next: AuthMode) {
    action.current?.controller.abort();
    setBusy(false);
    setMode(next);
    setError(null);
    setMessage(null);
    setToken(null);
    fragmentRef.current = null;
    router.push(authPath(locale, next, returnTo));
  }

  async function refreshSession(signal: AbortSignal) {
    const nextSession = await getSession(signal).catch(() => null);
    if (!signal.aborted) setSession(nextSession);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setError(null);
    setMessage(null);

    if ((mode === "register" || mode === "reset-password") && !isValidPassword(password)) {
      setError(text.passwordInvalid);
      return;
    }
    if (tokenModes.has(mode) && !token) {
      setError(text.tokenMissing);
      return;
    }

    const current = startAction();
    const payload = mode === "login" ? { email, password }
      : mode === "register" ? { email, password, fullName: String(form.get("fullName") ?? "").trim(), locale }
      : mode === "forgot-password" ? { email, locale }
      : mode === "reset-password" ? { token, password }
      : { token };
    const endpoint = mode === "login" ? "login" : mode === "register" ? "register" : mode === "forgot-password" ? "forgot-password" : mode === "reset-password" ? "reset-password" : "verify-email";

    try {
      const result = await postCustomerAuth<CustomerSession | Record<string, never>>(endpoint, payload, current.controller.signal);
      if (current.controller.signal.aborted || action.current?.id !== current.id) return;
      if (mode === "login") {
        consumeOAuthReturn(locale);
        setSession(result as CustomerSession);
        router.replace(safeReturnTo(returnTo, locale));
      } else if (mode === "verify-email") {
        setToken(null);
        await refreshSession(current.controller.signal);
        if (!current.controller.signal.aborted && action.current?.id === current.id) {
          setMessage(text.genericAccepted);
          const path = authPath(locale, "login", returnTo);
          router.replace(`${path}${path.includes("?") ? "&" : "?"}result=success`);
        }
      } else if (mode === "reset-password") {
        setToken(null);
        setSession(null);
        setMessage(text.genericAccepted);
        const path = authPath(locale, "login", returnTo);
        router.replace(`${path}${path.includes("?") ? "&" : "?"}result=success`);
      } else {
        formElement.reset();
        setMessage(text.genericAccepted);
      }
    } catch (cause) {
      if (!isAbortError(cause) && action.current?.id === current.id) setError(text.requestFailed);
    } finally {
      finishAction(current);
    }
  }

  async function endSession(endpoint: "logout" | "logout-all") {
    const current = startAction();
    setError(null);
    try {
      await postCustomerAuth<Record<string, never>>(endpoint, {}, current.controller.signal);
      if (current.controller.signal.aborted || action.current?.id !== current.id) return;
      setSession(null);
      setMessage(text.signedOut);
      router.replace(`/${locale}/auth/login?result=signed-out`);
    } catch (cause) {
      if (!isAbortError(cause) && action.current?.id === current.id) setError(text.requestFailed);
    } finally {
      finishAction(current);
    }
  }

  async function resend() {
    const current = startAction();
    setError(null);
    try {
      await postCustomerAuth<Record<string, never>>("resend-verification", { locale }, current.controller.signal);
      if (!current.controller.signal.aborted && action.current?.id === current.id) setMessage(text.genericAccepted);
    } catch (cause) {
      if (!isAbortError(cause) && action.current?.id === current.id) setError(text.requestFailed);
    } finally {
      finishAction(current);
    }
  }

  return { ready, config, session, mode, token, busy, message, error, text, retryLoad, changeMode, submit, resend, logout: () => endSession("logout"), logoutAll: () => endSession("logout-all") };
}

function isAbortError(cause: unknown) { return cause instanceof DOMException && cause.name === "AbortError"; }
function isValidPassword(value: string) { return value.length >= 12 && new TextEncoder().encode(value).length <= 72; }
