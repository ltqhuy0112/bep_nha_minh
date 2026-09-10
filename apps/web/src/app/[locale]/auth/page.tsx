import { notFound, redirect } from "next/navigation";
import { isLocale } from "@bep-nha-minh/shared/constants/i18n";
import { authPath, safeReturnTo } from "@/features/customer-auth/routes";

export default async function AuthIndex({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  redirect(authPath(locale, "login", safeReturnTo((await searchParams).next, locale)));
}
