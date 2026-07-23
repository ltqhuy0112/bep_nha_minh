import type { OrderStatus } from "@/lib/order-status";

const statusLabels: Record<OrderStatus | string, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  PREPARING: "Đang chuẩn bị",
  READY: "Sẵn sàng",
  DELIVERING: "Đang giao",
  COMPLETED: "Hoàn tất",
  REJECTED: "Từ chối",
  CANCELLED: "Đã hủy"
};

const statusClasses: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  PREPARING: "bg-sky-50 text-sky-800 ring-sky-200",
  READY: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  DELIVERING: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  COMPLETED: "bg-olive-700/10 text-olive-900 ring-olive-700/20",
  REJECTED: "bg-red-50 text-red-800 ring-red-200",
  CANCELLED: "bg-zinc-100 text-zinc-700 ring-zinc-200"
};

export function OrderStatusBadge({ status }: { status: OrderStatus | string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusClasses[status] ?? statusClasses.CANCELLED}`}
    >
      {statusLabels[status] ?? status}
    </span>
  );
}

export function getOrderStatusLabel(status: OrderStatus | string) {
  return statusLabels[status] ?? status;
}
