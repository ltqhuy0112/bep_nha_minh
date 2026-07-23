import { brandName } from "@/lib/site";

export function GET() {
  return Response.json(
    {
      name: brandName,
      short_name: brandName,
      start_url: "/vi",
      display: "standalone",
      background_color: "#fff9ed",
      theme_color: "#4f643d",
      icons: [
        {
          src: "/favicon.svg",
          sizes: "any",
          type: "image/svg+xml"
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
