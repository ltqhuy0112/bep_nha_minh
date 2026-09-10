import { query } from "@bep-nha-minh/api/db/client";
import { errorResponse, successResponse } from "@bep-nha-minh/api/lib/api-response";
import { logError } from "@bep-nha-minh/api/lib/logger";

export const runtime = "nodejs";

export async function GET() {
  try {
    await query("SELECT 1 AS ok");

    return successResponse(
      {
        status: "ok",
        database: "connected"
      },
      { message: "Service is healthy" }
    );
  } catch (error) {
    logError("Health check failed", error);
    return errorResponse(
      "SERVICE_UNAVAILABLE",
      "Service is not ready.",
      503
    );
  }
}
