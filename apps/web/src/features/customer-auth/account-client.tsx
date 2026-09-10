"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Notice, SessionView } from "./components";
import { authPath, consumeOAuthReturn, isAuthMode } from "./routes";
import { copyFor } from "./copy";
import type { Locale } from "./types";
import { useCustomerAuth } from "./use-customer-auth";

export function AccountClient({ locale }: { locale: Locale }) {
  const [checked, setChecked] = useState(false);
  const router = useRouter();
  const navigating = useRef(false);
  useEffect(() => {
    if (navigating.current) return;
    const query = new URLSearchParams(window.location.search);
    const mode = query.get("mode");
    // Preserve fragments for email links issued before the dedicated auth routes.
    if (isAuthMode(mode)) {
      navigating.current = true;
      router.replace(`${authPath(locale, mode)}${window.location.hash}`);
    } else if (query.get("oauth") === "error") {
      navigating.current = true;
      const target = consumeOAuthReturn(locale);
      const path = authPath(locale, "login", target);
      router.replace(`${path}${path.includes("?") ? "&" : "?"}oauth=error`);
    } else {
      queueMicrotask(() => setChecked(true));
    }
  }, [locale, router]);
  return <main className="botanical-section botanical-soft min-h-[calc(100vh-10rem)] py-14 md:py-20">
    <Container><div className="mx-auto max-w-lg">
      {checked ? <AccountSession locale={locale} /> : <p role="status">{copyFor(locale).loading}</p>}
    </div></Container>
  </main>;
}

function AccountSession({ locale }: { locale: Locale }) {
  const auth = useCustomerAuth(locale);
  const router = useRouter();
  useEffect(() => {
    if (!auth.ready || !auth.config?.enabled) return;
    if (!auth.session) {
      router.replace(authPath(locale, "login"));
      return;
    }
    const target = consumeOAuthReturn(locale);
    if (target !== `/${locale}/account`) router.replace(target);
  }, [auth.ready, auth.config?.enabled, auth.session, locale, router]);
  return <>
    {!auth.ready && !auth.error ? <p role="status">{auth.text.loading}</p> : null}
    {auth.config && !auth.config.enabled ? <Notice message={auth.text.unavailable} /> : null}
    {auth.config?.enabled && auth.session ? <SessionView session={auth.session} locale={locale} text={auth.text} busy={auth.busy} onResend={auth.resend} onLogout={auth.logout} onLogoutAll={auth.logoutAll} /> : null}
    {auth.config?.enabled && auth.session ? <Link href={`/${locale}/account/addresses`} className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">{locale === "vi" ? "Địa chỉ giao hàng" : "Delivery addresses"}</Link> : null}
    {auth.message ? <p className="mt-5 text-sm" role="status">{auth.message}</p> : null}
    {auth.error ? <p className="mt-5 text-sm text-red-800" role="alert">{auth.error}</p> : null}
    {auth.ready && !auth.config ? <button type="button" onClick={auth.retryLoad} className="mt-4 min-h-11 rounded-md border border-olive-700/20 px-4 text-sm font-semibold">{locale === "vi" ? "Thử lại" : "Try again"}</button> : null}
  </>;
}
