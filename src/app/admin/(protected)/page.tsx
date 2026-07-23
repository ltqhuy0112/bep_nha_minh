import { requirePermission } from "@/lib/admin/session";
import { getOrderAnalytics, type AnalyticsInput } from "@/services/admin-analytics";
import { listAdminOrders } from "@/services/admin-orders";
import { DashboardClient } from "@/components/admin/dashboard-client";
import {
  toClientDto,
  type AdminOrderListDto,
  type OrderAnalyticsDto
} from "@/components/admin/client-types";

type DashboardSearchParams = Promise<{
  range?: string;
  dateFrom?: string;
  dateTo?: string;
}>;

export default async function AdminDashboardPage({
  searchParams
}: {
  searchParams: DashboardSearchParams;
}) {
  const session = await requirePermission("admin.dashboard.view");
  const params = await searchParams;
  const analyticsInput: AnalyticsInput =
    params.dateFrom && params.dateTo
      ? { dateFrom: params.dateFrom, dateTo: params.dateTo }
      : params.range === "1d" || params.range === "3d" || params.range === "7d"
        ? { range: params.range }
        : { range: "7d" };
  const [analytics, recentOrders, pendingOrders] = await Promise.all([
    getOrderAnalytics(analyticsInput),
    listAdminOrders({
      page: 1,
      pageSize: 5,
      sortBy: "createdAt",
      sortDirection: "desc"
    }),
    listAdminOrders({
      page: 1,
      pageSize: 5,
      status: "PENDING",
      sortBy: "createdAt",
      sortDirection: "desc"
    })
  ]);
  const permissions = session.user.permissions;

  return (
    <DashboardClient
      initialAnalytics={toClientDto<OrderAnalyticsDto>(analytics)}
      recentOrders={toClientDto<AdminOrderListDto>(recentOrders)}
      pendingOrders={toClientDto<AdminOrderListDto>(pendingOrders)}
      permissions={permissions}
      initialFilters={{
        range:
          analyticsInput.range === "1d" || analyticsInput.range === "3d"
            ? analyticsInput.range
            : "7d",
        dateFrom: analyticsInput.dateFrom ?? "",
        dateTo: analyticsInput.dateTo ?? "",
        custom: Boolean(analyticsInput.dateFrom && analyticsInput.dateTo)
      }}
    />
  );
}
