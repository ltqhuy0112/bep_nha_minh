import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/admin/session";
import { uuidSchema } from "@/lib/admin/order-validation";
import { getAdminCustomerDetail } from "@/services/admin-customers";
import { formatDateTime, formatVnd } from "@/lib/admin/format";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { StatCard } from "@/components/admin/stat-card";

export default async function AdminCustomerDetailPage({
  params
}: {
  params: Promise<{ customerId: string }>;
}) {
  await requirePermission("customers.view");
  const { customerId } = await params;
  const parsedCustomerId = uuidSchema.safeParse(customerId);

  if (!parsedCustomerId.success) {
    notFound();
  }

  const customer = await getAdminCustomerDetail(parsedCustomerId.data);

  if (!customer) {
    notFound();
  }

  return (
    <div className="grid gap-5">
      <div>
        <a className="text-sm font-bold text-olive-700" href="/admin/customers">
          Quay lại khách hàng
        </a>
        <h1 className="mt-2 font-serif text-4xl text-olive-900">{customer.fullName}</h1>
        <p className="mt-2 text-muted">{customer.phone ?? customer.email ?? "Chưa có thông tin liên hệ"}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng đơn" value={String(customer.stats.totalOrderCount)} />
        <StatCard label="Giá trị hoàn tất" value={formatVnd(customer.stats.totalCompletedOrderValue)} />
        <StatCard label="Đơn đầu tiên" value={formatDateTime(customer.stats.firstOrderDate)} />
        <StatCard label="Đơn gần nhất" value={formatDateTime(customer.stats.latestOrderDate)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <section className="rounded-lg border border-olive-700/10 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Hồ sơ</h2>
          <div className="mt-4 grid gap-2 text-sm text-muted">
            <p>Email: {customer.email ?? "-"}</p>
            <p>Điện thoại: {customer.phone ?? "-"}</p>
            <p>
              Địa chỉ: {[customer.addressLine, customer.ward, customer.district, customer.city]
                .filter(Boolean)
                .join(", ") || "-"}
            </p>
            <p>Ghi chú: {customer.notes ?? "-"}</p>
          </div>
        </section>

        <section className="rounded-lg border border-olive-700/10 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Đơn gần đây</h2>
          <div className="mt-4 divide-y divide-olive-700/10">
            {customer.latestOrders.length === 0 ? (
              <p className="text-sm text-muted">Khách hàng chưa có đơn.</p>
            ) : (
              customer.latestOrders.map((order) => (
                <a
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="grid gap-2 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                >
                  <div>
                    <p className="font-bold text-olive-900">{order.orderCode}</p>
                    <p className="text-xs text-muted">{formatDateTime(order.createdAt)}</p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                  <p className="font-bold">{formatVnd(order.totalAmount)}</p>
                </a>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
