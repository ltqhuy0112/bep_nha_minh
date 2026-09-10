export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const brandName = "Bếp Nhà Mình";
export const brandShortName = "Bếp Nhà Mình";
export const hotline = "0915442787";
export const formattedHotline = "091 544 2787";
export const businessEmail =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@bepnhaminh.vn";
export const businessLocale = "vi_VN";
export const businessCountry = "VN";
export const businessRegion = "Ho Chi Minh City";
export const businessLocality = "TP. Hồ Chí Minh";
export const businessTimezone = "Asia/Ho_Chi_Minh";
export const businessCuisine = [
  "Vietnamese",
  "Healthy food",
  "Meal prep",
  "Pre-order meals"
];
export const businessAreaServed = [
  "TP. Hồ Chí Minh",
  "Quận 1",
  "Quận 3",
  "Bình Thạnh",
  "Phú Nhuận"
];
export const logoPath = "/brand-logo.jpg";
export const ogImagePath = "/og-image.svg";
export const socialProfileUrls = [
  process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://instagram.com/bepnhaminh.sg/",
  process.env.NEXT_PUBLIC_FACEBOOK_URL ||
    "https://facebook.com/profile.php?id=61591894748199",
  process.env.NEXT_PUBLIC_TIKTOK_URL || "https://tiktok.com/"
];

export const seoKeywords = {
  vi: [
    "Bếp Nhà Mình",
    "healthy food TP.HCM",
    "cơm healthy giao tận nơi",
    "meal prep healthy",
    "đồ ăn healthy Sài Gòn",
    "bữa trưa healthy",
    "bữa ăn lành mạnh",
    "pre-order healthy food"
  ],
  en: [
    "Bếp Nhà Mình",
    "healthy food Ho Chi Minh City",
    "healthy meal prep",
    "Vietnamese healthy meals",
    "pre-order healthy meals",
    "healthy lunch delivery",
    "small batch healthy kitchen"
  ]
} as const;

export function absoluteUrl(path: string) {
  return new URL(path, siteUrl).toString();
}
