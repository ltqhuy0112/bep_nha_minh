import { adminAuthErrorResponse, requirePermission } from "@/lib/admin/session";
import { errorResponse, successResponse } from "@/lib/api-response";
import { uuidSchema, zodFieldErrors } from "@/lib/admin/order-validation";
import { logError } from "@/lib/logger";
import { getAdminOrderDetail, OrderApiError } from "@/services/admin-orders";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    await requirePermission("orders.view", {
      redirectToLogin: false,
      redirectOnForbidden: false
    });

    const { orderId } = await context.params;
    const parsedOrderId = uuidSchema.safeParse(orderId);

    if (!parsedOrderId.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Mã đơn hàng không hợp lệ.",
        400,
        zodFieldErrors(parsedOrderId.error)
      );
    }

    const order = await getAdminOrderDetail(parsedOrderId.data);
    return successResponse({ order });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof OrderApiError) {
      return errorResponse(error.code, error.message, error.status);
    }

    logError("Failed to load admin order detail", error);
    return errorResponse(
      "ADMIN_ORDER_DETAIL_ERROR",
      "Không thể tải chi tiết đơn hàng.",
      500
    );
  }
}
