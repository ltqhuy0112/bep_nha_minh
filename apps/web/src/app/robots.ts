import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/vi", "/en", "/favicon.svg", "/og-image.svg"],
        disallow: [
          "/admin",
          "/admin/",
          "/api/admin",
          "/api/auth",
          "/api/docs",
          "/api/openapi.json",
          "/_next/static/chunks/"
        ]
      }
    ],
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
