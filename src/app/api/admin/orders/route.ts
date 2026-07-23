import { NextRequest } from "next/server";
import { requirePermission, adminAuthErrorResponse } from "@/lib/admin/session";
import { errorResponse, successResponse } from "@/lib/api-response";
import {
  orderListQuerySchema,
  zodFieldErrors
} from "@/lib/admin/order-validation";
import { logError } from "@/lib/logger";
import { listAdminOrders } from "@/services/admin-orders";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("orders.view", {
      redirectToLogin: false,
      redirectOnForbidden: false
    });

    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = orderListQuerySchema.safeParse(params);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Vui lòng kiểm tra lại bộ lọc đơn hàng.",
        400,
        zodFieldErrors(parsed.error)
      );
    }

    if (
      parsed.data.dateFrom &&
      parsed.data.dateTo &&
      parsed.data.dateFrom > parsed.data.dateTo
    ) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Ngày bắt đầu không được sau ngày kết thúc.",
        400,
        { dateFrom: "dateFrom must be before or equal to dateTo." }
      );
    }

    return successResponse(await listAdminOrders(parsed.data));
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    logError("Failed to list admin orders", error);
    return errorResponse(
      "ADMIN_ORDERS_ERROR",
      "Không thể tải danh sách đơn hàng.",
      500
    );
  }
}
