import Link from "next/link";
import type { AdminCustomerListItemDto } from "@bep-nha-minh/shared/types/admin";
import { formatDateTime, formatVnd } from "@/lib/admin/format";

export function CustomerTable({
  customers
}: {
  customers: AdminCustomerListItemDto[];
}) {
  if (customers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-olive-700/20 bg-white p-8 text-center text-muted">
        Chưa có khách hàng phù hợp với bộ lọc.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-olive-700/10 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-beige-200/50 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Khách hàng</th>
              <th className="px-4 py-3">Liên hệ</th>
              <th className="px-4 py-3">Khu vực</th>
              <th className="px-4 py-3">Đơn</th>
              <th className="px-4 py-3">Giá trị hoàn tất</th>
              <th className="px-4 py-3">Đơn gần nhất</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-olive-700/10">
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td className="px-4 py-4 font-bold text-olive-900">
                  <Link href={`/admin/customers/${customer.id}`}>{customer.fullName}</Link>
                </td>
                <td className="px-4 py-4 text-muted">
                  <p>{customer.phone ?? "-"}</p>
                  <p className="text-xs">{customer.email ?? "-"}</p>
                </td>
                <td className="px-4 py-4 text-muted">
                  {[customer.district, customer.city].filter(Boolean).join(", ") || "-"}
                </td>
                <td className="px-4 py-4 font-bold">{customer.totalOrders}</td>
                <td className="px-4 py-4 font-bold">{formatVnd(customer.completedValue)}</td>
                <td className="px-4 py-4 text-muted">{formatDateTime(customer.latestOrderAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
