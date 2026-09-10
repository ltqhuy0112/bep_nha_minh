import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@bep-nha-minh/shared/constants/i18n";
import { HtmlLangSync } from "@/components/layout/html-lang-sync";
import { AddressesClient } from "@/features/customer-addresses/addresses-client";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: `${locale === "vi" ? "Địa chỉ giao hàng" : "Delivery addresses"} | Bếp Nhà Mình`, robots: { index: false, follow: false }, referrer: "no-referrer" };
}
export default async function AddressesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <><HtmlLangSync locale={locale} /><AddressesClient locale={locale} /></>;
}
