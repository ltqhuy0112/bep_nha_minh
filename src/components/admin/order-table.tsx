import Link from "next/link";
import type { AdminOrderListItemDto } from "@/components/admin/client-types";
import { formatDate, formatDateTime, formatVnd } from "@/lib/admin/format";
import { OrderActions } from "@/components/admin/order-actions";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";

export function OrderTable({
  orders,
  permissions
}: {
  orders: AdminOrderListItemDto[];
  permissions: string[];
}) {
  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-olive-700/20 bg-white p-8 text-center text-muted">
        Chưa có đơn hàng phù hợp với bộ lọc.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-olive-700/10 bg-white shadow-sm">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-beige-200/50 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Mã đơn</th>
              <th className="px-4 py-3">Khách hàng</th>
              <th className="px-4 py-3">Ngày tạo</th>
              <th className="px-4 py-3">Ngày giao</th>
              <th className="px-4 py-3">Tổng</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-olive-700/10">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-4 py-4 font-bold text-olive-900">
                  <Link href={`/admin/orders/${order.id}`}>{order.orderCode}</Link>
                </td>
                <td className="px-4 py-4">
                  <p className="font-semibold">{order.customer.fullName}</p>
                  <p className="text-xs text-muted">{order.customer.phone ?? order.customer.email ?? "-"}</p>
                </td>
                <td className="px-4 py-4 text-muted">{formatDateTime(order.createdAt)}</td>
                <td className="px-4 py-4 text-muted">{formatDate(order.deliveryDate)}</td>
                <td className="px-4 py-4 font-bold">{formatVnd(order.totalAmount)}</td>
                <td className="px-4 py-4">
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className="px-4 py-4">
                  <div className="grid gap-2">
                    <Link className="text-xs font-bold text-olive-700" href={`/admin/orders/${order.id}`}>
                      Xem chi tiết
                    </Link>
                    <OrderActions orderId={order.id} status={order.status} permissions={permissions} compact />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 p-3 md:hidden">
        {orders.map((order) => (
          <article key={order.id} className="rounded-lg border border-olive-700/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link className="font-bold text-olive-900" href={`/admin/orders/${order.id}`}>
                  {order.orderCode}
                </Link>
                <p className="mt-1 text-sm text-muted">{order.customer.fullName}</p>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <p>
                <span className="block text-xs text-muted">Ngày tạo</span>
                {formatDateTime(order.createdAt)}
              </p>
              <p>
                <span className="block text-xs text-muted">Tổng</span>
                {formatVnd(order.totalAmount)}
              </p>
            </div>
            <div className="mt-4">
              <OrderActions orderId={order.id} status={order.status} permissions={permissions} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
