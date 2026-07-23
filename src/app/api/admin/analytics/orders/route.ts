import { NextRequest } from "next/server";
import { adminAuthErrorResponse, requirePermission } from "@/lib/admin/session";
import { errorResponse, successResponse } from "@/lib/api-response";
import {
  analyticsFieldErrors,
  orderAnalyticsQuerySchema
} from "@/lib/admin/analytics-validation";
import { logError } from "@/lib/logger";
import { getOrderAnalytics } from "@/services/admin-analytics";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("analytics.view", {
      redirectToLogin: false,
      redirectOnForbidden: false
    });

    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = orderAnalyticsQuerySchema.safeParse(params);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Vui lòng kiểm tra lại khoảng thời gian thống kê.",
        400,
        analyticsFieldErrors(parsed.error)
      );
    }

    const analytics = await getOrderAnalytics(parsed.data);
    return successResponse(analytics);
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    logError("Failed to load admin order analytics", error);
    return errorResponse(
      "ADMIN_ORDER_ANALYTICS_ERROR",
      "Không thể tải thống kê đơn hàng.",
      500
    );
  }
}
