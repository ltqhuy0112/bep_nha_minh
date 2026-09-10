import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteContents } from "@bep-nha-minh/api/data/site-content";
import { isLocale } from "@bep-nha-minh/shared/constants/i18n";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { HtmlLangSync } from "@/components/layout/html-lang-sync";
import { AccountClient } from "@/features/customer-auth/account-client";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const vietnamese = locale === "vi";
  return {
    title: vietnamese ? "Tài khoản | Bếp Nhà Mình" : "Account | Bếp Nhà Mình",
    description: vietnamese ? "Đăng nhập và quản lý tài khoản Bếp Nhà Mình." : "Sign in and manage your Bếp Nhà Mình account.",
    alternates: { canonical: `/${locale}/account`, languages: { vi: "/vi/account", en: "/en/account", "x-default": "/vi/account" } },
    robots: { index: false, follow: false }
  };
}

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const content = siteContents[locale];
  const nav = content.nav.map((item) => ({ ...item, href: `/${locale}${item.href}` }));
  return <><HtmlLangSync locale={locale} /><Header nav={nav} locale={locale} labels={content.header} /><AccountClient locale={locale} /><Footer description={content.footer.description} links={content.social.links} /></>;
}
