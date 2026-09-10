import { NextRequest } from "next/server";
import { adminAuthErrorResponse, requirePermission } from "@/lib/admin/session";
import { errorResponse, successResponse } from "@bep-nha-minh/api/lib/api-response";
import {
  reasonSchema,
  uuidSchema,
  zodFieldErrors
} from "@bep-nha-minh/api/lib/admin/order-validation";
import { logError } from "@bep-nha-minh/api/lib/logger";
import { OrderApiError, rejectOrder } from "@bep-nha-minh/api/services/admin-orders";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await requirePermission("orders.reject", {
      redirectToLogin: false,
      redirectOnForbidden: false
    });

    const routeInput = uuidSchema.safeParse((await context.params).orderId);
    if (!routeInput.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Mã đơn hàng không hợp lệ.",
        400,
        zodFieldErrors(routeInput.error)
      );
    }

    const parsedBody = reasonSchema.safeParse(await parseJson(request));
    if (!parsedBody.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Vui lòng nhập lý do từ chối.",
        400,
        zodFieldErrors(parsedBody.error)
      );
    }

    const order = await rejectOrder({
      orderId: routeInput.data,
      adminSession: session,
      reason: parsedBody.data.reason,
      requestMeta: getRequestMeta(request)
    });

    return successResponse(
      { order },
      { message: "Đơn hàng đã được từ chối." }
    );
  } catch (error) {
    return handleMutationError(error, "Failed to reject order");
  }
}

async function parseJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new OrderApiError(
      "INVALID_JSON",
      "Dữ liệu gửi lên không hợp lệ.",
      400
    );
  }
}

function getRequestMeta(request: NextRequest) {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent")
  };
}

function handleMutationError(error: unknown, logMessage: string) {
  const authResponse = adminAuthErrorResponse(error);
  if (authResponse) {
    return authResponse;
  }

  if (error instanceof OrderApiError) {
    return errorResponse(error.code, error.message, error.status);
  }

  logError(logMessage, error);
  return errorResponse(
    "ADMIN_ORDER_MUTATION_ERROR",
    "Không thể cập nhật trạng thái đơn hàng.",
    500
  );
}
