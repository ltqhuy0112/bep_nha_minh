import { getPublishedSiteContent } from "@/db/queries/site-content";
import { errorResponse, successResponse } from "@/lib/api-response";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET() {
  try {
    const records = await getPublishedSiteContent();
    const sections = Object.fromEntries(
      records.map((record) => [record.section_key, record.content_json])
    );

    return successResponse({ sections });
  } catch (error) {
    logError("Failed to load site content", error);
    return errorResponse(
      "SITE_CONTENT_ERROR",
      "Không thể tải nội dung website.",
      500
    );
  }
}
