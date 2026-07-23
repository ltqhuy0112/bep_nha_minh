import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { brandName, siteUrl } from "@/lib/site";

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
  "Bếp Nhà Mình là căn bếp healthy nhỏ, phục vụ các bữa ăn tươi mới theo hình thức pre-order dành cho người bận rộn.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: brandName,
    locale: "vi_VN",
    type: "website",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Bếp Nhà Mình healthy food làm mới theo đơn"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title,
    description
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
