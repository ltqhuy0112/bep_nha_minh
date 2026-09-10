import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteContents } from "@bep-nha-minh/api/data/site-content";
import { isLocale } from "@bep-nha-minh/shared/constants/i18n";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { HtmlLangSync } from "@/components/layout/html-lang-sync";
import { CartClient } from "@/features/cart/components/cart-client";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const vietnamese = locale === "vi";
  return { title: vietnamese ? "Giỏ hàng | Bếp Nhà Mình" : "Cart | Bếp Nhà Mình", description: vietnamese ? "Giỏ hàng Bếp Nhà Mình." : "Your Bếp Nhà Mình cart.", alternates: { canonical: `/${locale}/cart`, languages: { vi: "/vi/cart", en: "/en/cart", "x-default": "/vi/cart" } }, robots: { index: false, follow: false } };
}

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const content = siteContents[locale];
  const nav = content.nav.map((item) => ({ ...item, href: `/${locale}${item.href}` }));
  return <><HtmlLangSync locale={locale} /><Header nav={nav} locale={locale} labels={content.header} /><CartClient locale={locale} /><Footer description={content.footer.description} links={content.social.links} /></>;
}
