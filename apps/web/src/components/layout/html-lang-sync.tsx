"use client";

import { useEffect } from "react";
import type { Locale } from "@bep-nha-minh/shared/constants/i18n";

export function HtmlLangSync({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
