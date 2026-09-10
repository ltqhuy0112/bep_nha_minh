import type { AuthMode, Locale } from "./types";

export function isAuthMode(value: unknown): value is AuthMode {
  return typeof value === "string" && ["login", "register", "forgot-password", "reset-password", "verify-email"].includes(value);
}

export function safeReturnTo(value: unknown, locale: Locale): string {
  // Only literal, same-locale destinations; never accept arbitrary URLs or query strings.
  return typeof value === "string" && [`/${locale}/account`, `/${locale}/menu`, `/${locale}/checkout`].includes(value)
    ? value : `/${locale}/account`;
}

export function authPath(locale: Locale, mode: AuthMode, returnTo?: string): string {
  const target = safeReturnTo(returnTo, locale);
  const query = target === `/${locale}/account` ? "" : `?next=${encodeURIComponent(target)}`;
  return `/${locale}/auth/${mode}${query}`;
}

const returnKey = "bnm_auth_return";
export function rememberOAuthReturn(locale: Locale, returnTo: string) {
  try {
    sessionStorage.setItem(returnKey, JSON.stringify({ locale, target: safeReturnTo(returnTo, locale), expires: Date.now() + 600_000 }));
  } catch { /* A blocked storage API falls back to the account page. */ }
}

export function consumeOAuthReturn(locale: Locale): string {
  try {
    const raw = sessionStorage.getItem(returnKey);
    sessionStorage.removeItem(returnKey);
    const value = raw ? JSON.parse(raw) : null;
    if (value?.locale === locale && typeof value.expires === "number" && value.expires > Date.now() && value.expires <= Date.now() + 600_000) {
      return safeReturnTo(value.target, locale);
    }
  } catch { /* Untrusted or unavailable browser storage is never a redirect authority. */ }
  return `/${locale}/account`;
}
