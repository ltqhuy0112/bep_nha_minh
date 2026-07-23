import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import {
  absoluteUrl,
  brandName,
  businessLocale,
  formattedHotline,
  ogImagePath,
  seoKeywords,
  siteUrl
} from "@/lib/site";

const serif = Cormorant_Garamond({
  subsets: ["latin", "vietnamese"],
  variable: "--font-serif",
  display: "swap"
});

const sans = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
  display: "swap"
});

const title = "Bếp Nhà Mình | Healthy Food Làm Mới Theo Đơn";
const description =
  "Bếp Nhà Mình là căn bếp healthy nhỏ tại TP.HCM, phục vụ bữa ăn lành mạnh làm mới theo đơn cho người bận rộn.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: brandName,
  title,
  description,
  keywords: [...seoKeywords.vi],
  authors: [{ name: brandName, url: siteUrl }],
  creator: brandName,
  publisher: brandName,
  category: "FoodService",
  formatDetection: {
    telephone: true,
    email: true,
    address: true
  },
  alternates: {
    canonical: "/vi",
    languages: {
      vi: "/vi",
      en: "/en",
      "x-default": "/vi"
    }
  },
  openGraph: {
    title,
    description,
    url: "/vi",
    siteName: brandName,
    locale: businessLocale,
    type: "website",
    phoneNumbers: [formattedHotline],
    images: [
      {
        url: absoluteUrl(ogImagePath),
        width: 1200,
        height: 630,
        alt: "Bếp Nhà Mình healthy food làm mới theo đơn"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [absoluteUrl(ogImagePath)]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${serif.variable} ${sans.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
