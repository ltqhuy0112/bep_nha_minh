import type { Locale } from "@bep-nha-minh/shared/constants/i18n";

export function formatPrice(value: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}
