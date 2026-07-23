import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n";
import { absoluteUrl, ogImagePath, siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-07-23T00:00:00.000Z");
  const images = [absoluteUrl(ogImagePath)];

  return [
    {
      url: `${siteUrl}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
      images
    },
    ...locales.map((locale) => ({
      url: `${siteUrl}/${locale}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: locale === "vi" ? 1 : 0.9,
      images
    }))
  ];
}
