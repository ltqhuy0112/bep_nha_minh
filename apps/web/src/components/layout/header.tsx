"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { usePathname } from "next/navigation";
import type { NavItem } from "@bep-nha-minh/shared/types/site";
import {
  locales,
  type Locale
} from "@bep-nha-minh/shared/constants/i18n";
import { Button } from "@/components/ui/button";
import { orderingEnabled } from "@/lib/ordering";

type HeaderProps = {
  nav: NavItem[];
  locale: Locale;
  labels: {
    brandAriaLabel: string;
    tagline: string;
    waitlistCta: string;
    menuAriaLabel: string;
    desktopNavAriaLabel: string;
    mobileNavAriaLabel: string;
    languageLabel: string;
  };
};

export function Header({ nav, locale, labels }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuLabel = locale === "vi" ? "Thực đơn" : "Menu";
  const menuHref = `/${locale}/menu`;
  const homeHref = `/${locale}`;
  const waitlistHref = pathname === homeHref ? "#waitlist" : `${homeHref}#waitlist`;
  const headerNav = [
    ...nav.slice(0, 1),
    { label: menuLabel, href: menuHref },
    ...nav.slice(1)
  ];

  function localeHref(nextLocale: Locale) {
    return pathname.replace(/^\/(?:vi|en)(?=\/|$)/, `/${nextLocale}`);
  }

  function navigationHref(href: string) {
    return href.startsWith("#") && pathname !== homeHref ? `${homeHref}${href}` : href;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-olive-700/10 bg-cream-100/92 backdrop-blur">
      <div className="bg-olive-900 px-5 py-2 text-center text-xs font-semibold text-cream-100 sm:text-sm">
        {locale === "vi" ? "Bếp đang chuẩn bị mở bán tại TP.HCM · " : "The kitchen is preparing to open in HCMC · "}
        <a href={waitlistHref} className="underline underline-offset-4 hover:text-beige-200">
          {locale === "vi" ? "Nhận lịch mở bán" : "Get launch updates"}
        </a>
      </div>
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5">
        <a
          href={homeHref}
          className="group inline-flex items-center gap-3 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-olive-700"
          aria-label={labels.brandAriaLabel}
        >
          <span className="relative size-12 shrink-0 overflow-hidden rounded-full border border-olive-700/15 bg-olive-700 shadow-soft">
            <Image src="/brand-logo.jpg" alt="" fill sizes="48px" className="object-cover" />
          </span>
          <span className="sr-only">
            bếp
            <br />
            nhà
          </span>
          <span className="hidden text-left sm:block">
            <span className="block font-serif text-xl leading-none text-olive-900">
              Bếp Nhà Mình
            </span>
            <span className="text-xs font-semibold text-muted">
              {labels.tagline}
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 xl:flex" aria-label={labels.desktopNavAriaLabel}>
          {headerNav.map((item) => (
            <a
              key={item.href}
              href={navigationHref(item.href)}
              className="rounded-full px-4 py-2 text-sm font-semibold text-olive-900 transition hover:bg-olive-700/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive-700"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden xl:block">
          <Button href={waitlistHref} variant="primary">
            {labels.waitlistCta}
          </Button>
        </div>

        <nav
          className="hidden items-center gap-1 rounded-full border border-olive-700/15 bg-white/70 p-1 xl:flex"
          aria-label={labels.languageLabel}
        >
          {locales.map((item) => (
            <a
              key={item}
              href={localeHref(item)}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-bold uppercase transition",
                item === locale
                  ? "bg-olive-700 text-cream-100"
                  : "text-olive-900 hover:bg-olive-700/10"
              ].join(" ")}
            >
              {item}
            </a>
          ))}
        </nav>

        {orderingEnabled ? (
          <Link href={`/${locale}/cart`} aria-label={locale === "vi" ? "Giỏ hàng" : "Shopping cart"} title={locale === "vi" ? "Giỏ hàng" : "Shopping cart"} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-olive-900 hover:bg-olive-700/10">
            <ShoppingBag size={22} aria-hidden="true" />
          </Link>
        ) : null}
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-full border border-olive-700/20 text-olive-900 xl:hidden"
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label={labels.menuAriaLabel}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="relative block h-4 w-5">
            <span className={`absolute left-0 top-0 h-0.5 w-5 bg-current transition ${open ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`absolute left-0 top-2 h-0.5 w-5 bg-current transition ${open ? "opacity-0" : ""}`} />
            <span className={`absolute left-0 top-4 h-0.5 w-5 bg-current transition ${open ? "-translate-y-2 -rotate-45" : ""}`} />
          </span>
        </button>
      </div>

      {open ? (
        <div
          id="mobile-navigation"
          className="border-t border-olive-700/10 bg-cream-100 px-5 py-4 xl:hidden"
        >
          <nav className="mx-auto grid max-w-6xl gap-2" aria-label={labels.mobileNavAriaLabel}>
            {headerNav.map((item) => (
              <a
                key={item.href}
                href={navigationHref(item.href)}
                className="rounded-2xl px-4 py-3 text-base font-semibold text-olive-900 hover:bg-olive-700/10"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2 border-t border-olive-700/10 pt-3">
              {locales.map((item) => (
                <a
                  key={item}
                  href={localeHref(item)}
                  className={[
                    "rounded-full px-4 py-2 text-sm font-bold uppercase",
                    item === locale
                      ? "bg-olive-700 text-cream-100"
                      : "border border-olive-700/15 text-olive-900"
                  ].join(" ")}
                  onClick={() => setOpen(false)}
                >
                  {item}
                </a>
              ))}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
