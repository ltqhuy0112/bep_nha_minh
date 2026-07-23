import { brandName, logoPath } from "@/lib/site";

export function GET() {
  return Response.json(
    {
      name: brandName,
      short_name: brandName,
      description:
        "Bếp Nhà Mình là căn bếp healthy nhỏ tại TP.HCM, phục vụ bữa ăn làm mới theo đơn.",
      start_url: "/vi",
      display: "standalone",
      background_color: "#fff9ed",
      theme_color: "#4f643d",
      icons: [
        {
          src: "/favicon.svg",
          sizes: "any",
          type: "image/svg+xml"
        },
        {
          src: logoPath,
          sizes: "200x200",
          type: "image/jpeg",
          purpose: "any"
        }
      ]
    },
    {
      headers: {
        "Content-Type": "application/manifest+json"
      }
    }
  );
}
