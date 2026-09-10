import { NextRequest } from "next/server";
import { adminAuthErrorResponse, requirePermission } from "@/lib/admin/session";
import { errorResponse, successResponse } from "@bep-nha-minh/api/lib/api-response";
import {
  customerFieldErrors,
  customerListQuerySchema
} from "@bep-nha-minh/api/lib/admin/customer-validation";
import { logError } from "@bep-nha-minh/api/lib/logger";
import { listAdminCustomers } from "@bep-nha-minh/api/services/admin-customers";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("customers.view", {
      redirectToLogin: false,
      redirectOnForbidden: false
    });

    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = customerListQuerySchema.safeParse(params);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Vui lòng kiểm tra lại bộ lọc khách hàng.",
        400,
        customerFieldErrors(parsed.error)
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

    return successResponse(await listAdminCustomers(parsed.data));
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    logError("Failed to list admin customers", error);
    return errorResponse(
      "ADMIN_CUSTOMERS_ERROR",
      "Không thể tải danh sách khách hàng.",
      500
    );
  }
}
