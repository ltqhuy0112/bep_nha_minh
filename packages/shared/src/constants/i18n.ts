export const locales = ["vi", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "vi";

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function localizedPath(locale: Locale, hash = "") {
  return `/${locale}${hash}`;
}

export function getPublicLocalePath(locale: Locale) {
  return `/${locale}`;
}
