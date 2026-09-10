import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/admin/session";
import { uuidSchema } from "@bep-nha-minh/api/lib/admin/order-validation";
import { getAdminOrderDetail, OrderApiError } from "@bep-nha-minh/api/services/admin-orders";
import { formatDate, formatDateTime, formatVnd } from "@/lib/admin/format";
import { OrderActions } from "@/components/admin/order-actions";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";

export default async function AdminOrderDetailPage({
  params
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await requirePermission("orders.view");
  const { orderId } = await params;
  const parsedOrderId = uuidSchema.safeParse(orderId);

  if (!parsedOrderId.success) {
    notFound();
  }

  let order: Awaited<ReturnType<typeof getAdminOrderDetail>>;
  try {
    order = await getAdminOrderDetail(parsedOrderId.data);
  } catch (error) {
    if (error instanceof OrderApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <a className="text-sm font-bold text-olive-700" href="/admin/orders">
            Quay lại đơn hàng
          </a>
          <h1 className="mt-2 font-serif text-4xl text-olive-900">{order.orderCode}</h1>
          <div className="mt-3">
            <OrderStatusBadge status={order.status} />
          </div>
        </div>
        <OrderActions orderId={order.id} status={order.status} permissions={session.user.permissions} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="grid gap-5">
          <div className="rounded-lg border border-olive-700/10 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Món đã đặt</h2>
            <div className="mt-4 divide-y divide-olive-700/10">
              {order.items.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_auto] gap-4 py-3">
                  <div>
                    <p className="font-bold">{item.itemName}</p>
                    <p className="text-sm text-muted">
                      {item.quantity} x {formatVnd(item.unitPrice)}
                    </p>
                  </div>
                  <p className="font-bold">{formatVnd(item.lineTotal)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-olive-700/10 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Timeline trạng thái</h2>
            <div className="mt-4 grid gap-3">
              {order.statusHistory.length === 0 ? (
                <p className="text-sm text-muted">Chưa có lịch sử trạng thái.</p>
              ) : (
                order.statusHistory.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-olive-700/10 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <OrderStatusBadge status={entry.toStatus} />
                      <span className="text-sm text-muted">{formatDateTime(entry.createdAt)}</span>
                    </div>
                    {entry.reason ? <p className="mt-2 text-sm">{entry.reason}</p> : null}
                    {entry.changedBy ? (
                      <p className="mt-1 text-xs text-muted">Bởi {entry.changedBy.name ?? entry.changedBy.email}</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <aside className="grid gap-5">
          <div className="rounded-lg border border-olive-700/10 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Khách hàng</h2>
            <div className="mt-4 grid gap-2 text-sm">
              <a className="font-bold text-olive-700" href={`/admin/customers/${order.customer.id}`}>
                {order.customer.fullName}
              </a>
              <p>{order.customer.phone ?? "-"}</p>
              <p>{order.customer.email ?? "-"}</p>
              <p className="text-muted">
                {[order.customer.addressLine, order.customer.ward, order.customer.district, order.customer.city]
                  .filter(Boolean)
                  .join(", ") || "-"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-olive-700/10 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Giao nhận</h2>
            <div className="mt-4 grid gap-2 text-sm">
              <p>Hình thức: {order.fulfillmentType}</p>
              <p>Ngày: {formatDate(order.deliveryDate)}</p>
              <p>Khung giờ: {order.deliveryTimeSlot ?? "-"}</p>
            </div>
          </div>

          <div className="rounded-lg border border-olive-700/10 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Thanh toán</h2>
            <dl className="mt-4 grid gap-2 text-sm">
              <Row label="Tạm tính" value={formatVnd(order.pricing.subtotalAmount)} />
              <Row label="Phí giao" value={formatVnd(order.pricing.deliveryFee)} />
              <Row label="Giảm giá" value={formatVnd(order.pricing.discountAmount)} />
              <Row label="Tổng" value={formatVnd(order.pricing.totalAmount)} strong />
            </dl>
          </div>

          <div className="rounded-lg border border-olive-700/10 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Ghi chú</h2>
            <p className="mt-3 text-sm text-muted">Khách: {order.customerNote ?? "-"}</p>
            <p className="mt-2 text-sm text-muted">Nội bộ: {order.internalNote ?? "-"}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "text-base font-bold" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
