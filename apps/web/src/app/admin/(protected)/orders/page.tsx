import { requirePermission } from "@/lib/admin/session";
import { orderListQuerySchema } from "@bep-nha-minh/api/lib/admin/order-validation";
import { listAdminOrders } from "@bep-nha-minh/api/services/admin-orders";
import { OrderListClient } from "@/components/admin/order-list-client";
import { toClientDto } from "@/components/admin/client-types";
import type { OrderStatus } from "@bep-nha-minh/shared/constants/order-status";
import type { AdminOrderListDto } from "@bep-nha-minh/shared/types/admin";

type OrdersSearchParams = Promise<Record<string, string | undefined>>;

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams: OrdersSearchParams;
}) {
  const session = await requirePermission("orders.view");
  const params = await searchParams;
  const parsed = orderListQuerySchema.safeParse(params);
  const filters = parsed.success
    ? parsed.data
    : {
        page: 1,
        pageSize: 20,
        sortBy: "createdAt" as const,
        sortDirection: "desc" as const
      };
  const orders = await listAdminOrders(filters);

  return (
    <OrderListClient
      initialOrders={toClientDto<AdminOrderListDto>(orders)}
      initialFilters={{
        page: filters.page,
        pageSize: filters.pageSize,
        search: filters.search ?? "",
        status: (filters.status ?? "") as "" | OrderStatus,
        dateFrom: filters.dateFrom ?? "",
        dateTo: filters.dateTo ?? "",
        sortBy: filters.sortBy,
        sortDirection: filters.sortDirection
      }}
      permissions={session.user.permissions}
    />
  );
}
