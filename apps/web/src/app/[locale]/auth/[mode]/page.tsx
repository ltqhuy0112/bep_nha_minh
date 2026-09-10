import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@bep-nha-minh/shared/constants/i18n";
import { AuthClient } from "@/features/customer-auth/auth-client";
import { copyFor } from "@/features/customer-auth/copy";
import { isAuthMode, safeReturnTo } from "@/features/customer-auth/routes";

type Props = { params: Promise<{ locale: string; mode: string }>; searchParams: Promise<{ next?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, mode } = await params;
  if (!isLocale(locale) || !isAuthMode(mode)) return {};
  const text = copyFor(locale);
  const titles = { login: text.login, register: text.register, "forgot-password": text.forgotPassword, "reset-password": text.resetPassword, "verify-email": text.verifyEmail };
  return { title: `${titles[mode]} | Bếp Nhà Mình`, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function AuthPage({ params, searchParams }: Props) {
  const { locale, mode } = await params;
  if (!isLocale(locale) || !isAuthMode(mode)) notFound();
  const { next } = await searchParams;
  return <AuthClient key={`${locale}:${mode}`} locale={locale} mode={mode} returnTo={safeReturnTo(next, locale)} />;
}
