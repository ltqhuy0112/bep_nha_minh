import { notFound } from "next/navigation";
import { siteContents } from "@bep-nha-minh/api/data/site-content";
import { isLocale } from "@bep-nha-minh/shared/constants/i18n";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { HtmlLangSync } from "@/components/layout/html-lang-sync";
import { CatalogMenu } from "@/features/catalog/components/catalog-menu";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const isVietnamese = locale === "vi";
  return {
    title: isVietnamese ? "Thực đơn | Bếp Nhà Mình" : "Menu | Bếp Nhà Mình",
    description: isVietnamese ? "Thực đơn các món hiện có tại Bếp Nhà Mình." : "Current meals from Bếp Nhà Mình.",
    alternates: { canonical: `/${locale}/menu`, languages: { vi: "/vi/menu", en: "/en/menu", "x-default": "/vi/menu" } }
  };
}

export default async function MenuPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const content = siteContents[rawLocale];
  const nav = content.nav.map((item) => ({ ...item, href: `/${rawLocale}${item.href}` }));
  return <><HtmlLangSync locale={rawLocale} /><Header nav={nav} locale={rawLocale} labels={content.header} /><CatalogMenu locale={rawLocale} /><Footer description={content.footer.description} links={content.social.links} /></>;
}
import type { Metadata } from "next";
