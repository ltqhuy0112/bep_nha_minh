import { openApiDocument } from "@bep-nha-minh/api/lib/openapi";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  return Response.json(openApiDocument, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}
