import { notFound } from "next/navigation";
import { siteContents } from "@/lib/site-content";
import { isLocale } from "@bep-nha-minh/shared/constants/i18n";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { HtmlLangSync } from "@/components/layout/html-lang-sync";
import { CatalogProductDetail } from "@/features/catalog/components/catalog-product-detail";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const isVietnamese = locale === "vi";
  return {
    title: isVietnamese ? "Chi tiết món | Bếp Nhà Mình" : "Meal details | Bếp Nhà Mình",
    description: isVietnamese ? "Thông tin món và khung nhận món tại Bếp Nhà Mình." : "Meal and fulfillment details from Bếp Nhà Mình.",
    alternates: { canonical: `/${locale}/menu/${encodeURIComponent(slug)}`, languages: { vi: `/vi/menu/${encodeURIComponent(slug)}`, en: `/en/menu/${encodeURIComponent(slug)}`, "x-default": `/vi/menu/${encodeURIComponent(slug)}` } }
  };
}

export default async function MenuProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const content = siteContents[rawLocale];
  const nav = content.nav.map((item) => ({ ...item, href: `/${rawLocale}${item.href}` }));
  return <><HtmlLangSync locale={rawLocale} /><Header nav={nav} locale={rawLocale} labels={content.header} /><CatalogProductDetail locale={rawLocale} slug={slug} /><Footer description={content.footer.description} links={content.social.links} /></>;
}
import type { Metadata } from "next";
