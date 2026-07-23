import { NextRequest } from "next/server";
import {
  createWaitlistLead,
  findExistingWaitlistLead
} from "@/db/queries/waitlist";
import { errorResponse, successResponse } from "@/lib/api-response";
import { logError } from "@/lib/logger";
import { waitlistSchema } from "@/lib/validation";

export const runtime = "nodejs";

const successMessage =
  "Bếp đã nhận được thông tin của bạn. Khi menu mở bán, Bếp Nhà Mình sẽ gửi thông báo sớm nhất 🌿";

function toFieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const details: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!details[field]) {
      details[field] = issue.message;
    }
  }

  return details;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      "INVALID_JSON",
      "Dữ liệu gửi lên không hợp lệ.",
      400
    );
  }

  const parsed = waitlistSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Vui lòng kiểm tra lại thông tin.",
      400,
      toFieldErrors(parsed.error)
    );
  }

  try {
    const existing = await findExistingWaitlistLead(parsed.data);

    if (existing) {
      return errorResponse(
        "DUPLICATE_WAITLIST_LEAD",
        "Thông tin này đã có trong danh sách chờ.",
        409
      );
    }

    const lead = await createWaitlistLead(parsed.data);

    return successResponse(
      {
        id: lead.id,
        status: lead.status,
        createdAt: lead.created_at
      },
      {
        status: 201,
        message: successMessage
      }
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return errorResponse(
        "DUPLICATE_WAITLIST_LEAD",
        "Thông tin này đã có trong danh sách chờ.",
        409
      );
    }

    logError("Failed to create waitlist lead", error);
    return errorResponse(
      "WAITLIST_ERROR",
      "Bếp chưa thể nhận thông tin lúc này. Vui lòng thử lại sau.",
      500
    );
  }
}
