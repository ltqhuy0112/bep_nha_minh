"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, RotateCw } from "lucide-react";
import { HtmlLangSync } from "@/components/layout/html-lang-sync";
import { AuthForm, Notice } from "./components";
import { authPath, safeReturnTo } from "./routes";
import { useCustomerAuth } from "./use-customer-auth";
import type { AuthMode, Locale } from "./types";
import styles from "./auth-client.module.css";

export function AuthClient({ locale, mode, returnTo }: { locale: Locale; mode: AuthMode; returnTo: string }) {
  const router = useRouter();
  const auth = useCustomerAuth(locale, mode, returnTo);
  const tokenFlow = mode === "verify-email" || mode === "reset-password";
  const otherLocale = locale === "vi" ? "en" : "vi";
  const otherTarget = safeReturnTo(returnTo.replace(`/${locale}/`, `/${otherLocale}/`), otherLocale);
  useEffect(() => {
    if (auth.ready && auth.session && !tokenFlow) router.replace(safeReturnTo(returnTo, locale));
  }, [auth.ready, auth.session, tokenFlow, router, returnTo, locale]);

  return <main className={`${styles.page} min-h-dvh text-olive-900`}>
    <HtmlLangSync locale={locale} />
    <header className={`${styles.header} flex min-h-20 items-center justify-between gap-4 px-5 sm:px-10`}>
      <Link href={`/${locale}/menu`} className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={18} />{locale === "vi" ? "Thực đơn" : "Menu"}</Link>
      {!tokenFlow ? <Link href={authPath(otherLocale, mode, otherTarget)} className="text-sm font-semibold" hrefLang={otherLocale}>{otherLocale === "vi" ? "Tiếng Việt" : "English"}</Link> : null}
    </header>
    <div className={`${styles.panel} mx-auto w-full max-w-[480px]`}>
      <Link href={`/${locale}`} className="mb-8 flex flex-col items-center gap-4">
        <Image src="/brand-logo.jpg" alt="Bếp Nhà Mình" width={72} height={72} className="rounded-full" priority />
        <span className="font-serif text-3xl font-semibold">Bếp Nhà Mình</span>
      </Link>
      {!auth.ready && !auth.error ? <p className="py-6 text-center text-sm text-muted" role="status">{auth.text.loading}</p> : null}
      {auth.config && !auth.config.enabled ? <Notice message={auth.text.unavailable} /> : null}
      {auth.ready && auth.config?.enabled && (!auth.session || tokenFlow) ? <AuthForm mode={auth.mode} text={auth.text} token={auth.token} busy={auth.busy} emailEnabled={auth.config.emailEnabled} oauth={auth.config.oauth} locale={locale} returnTo={returnTo} onSubmit={auth.submit} onMode={auth.changeMode} /> : null}
      {auth.message ? <p className="mt-5 text-sm font-medium text-olive-900" role="status">{auth.message}</p> : null}
      {auth.error ? <p className="mt-5 text-sm font-medium text-red-800" role="alert">{auth.error}</p> : null}
      {auth.ready && !auth.config ? <button type="button" onClick={auth.retryLoad} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-olive-700/20 px-4 text-sm font-semibold"><RotateCw size={16} />{locale === "vi" ? "Thử lại" : "Try again"}</button> : null}
    </div>
  </main>;
}
