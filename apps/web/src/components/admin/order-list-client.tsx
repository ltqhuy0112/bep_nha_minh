"use client";

import { useState } from "react";
import { OrderTable } from "@/components/admin/order-table";
import type { OrderStatus } from "@bep-nha-minh/shared/constants/order-status";
import type { AdminOrderListDto } from "@bep-nha-minh/shared/types/admin";
import type { ApiResponse } from "@bep-nha-minh/shared/types/api-response";

type OrderFilters = {
  page: number;
  pageSize: number;
  search: string;
  status: "" | OrderStatus;
  dateFrom: string;
  dateTo: string;
  sortBy: "createdAt" | "deliveryDate" | "orderCode" | "status" | "totalAmount";
  sortDirection: "asc" | "desc";
};

const statusOptions: { value: "" | OrderStatus; label: string }[] = [
  { value: "", label: "Tất cả" },
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "PREPARING", label: "Đang chuẩn bị" },
  { value: "READY", label: "Sẵn sàng" },
  { value: "DELIVERING", label: "Đang giao" },
  { value: "COMPLETED", label: "Hoàn tất" },
  { value: "REJECTED", label: "Từ chối" },
  { value: "CANCELLED", label: "Đã hủy" }
];

export function OrderListClient({
  initialOrders,
  initialFilters,
  permissions
}: {
  initialOrders: AdminOrderListDto;
  initialFilters: OrderFilters;
  permissions: string[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [filters, setFilters] = useState(initialFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadOrders(nextFilters: OrderFilters) {
    setIsLoading(true);
    setError(null);

    try {
      const query = buildOrderQuery(nextFilters);
      const response = await fetch(`/api/admin/orders?${query}`, {
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json()) as ApiResponse<AdminOrderListDto>;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success ? "Không thể tải đơn hàng." : payload.error.message
        );
      }

      setOrders(payload.data);
      setFilters(nextFilters);
      replaceUrl("/admin/orders", query);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải đơn hàng."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function updateFilter<Key extends keyof OrderFilters>(
    key: Key,
    value: OrderFilters[Key]
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const totalPages = Math.max(orders.pagination.totalPages, 1);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-wood-500">
            Orders
          </p>
          <h1 className="mt-2 font-serif text-4xl text-olive-900">Đơn hàng</h1>
        </div>
        <div className="w-full rounded-lg border border-olive-700/10 bg-white p-3 shadow-sm lg:w-auto">
          <div className="grid gap-2 xl:grid-cols-[minmax(220px,1.5fr)_minmax(160px,0.8fr)_auto_auto_auto] xl:items-end">
            <FilterField label="Tìm kiếm">
              <input
                placeholder="Mã đơn, tên, SĐT, email"
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                className="filter-control"
              />
            </FilterField>
            <FilterField label="Trạng thái">
              <select
                value={filters.status}
                onChange={(event) =>
                  updateFilter("status", event.target.value as OrderFilters["status"])
                }
                className="filter-control"
              >
                {statusOptions.map((status) => (
                  <option key={status.value || "all"} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Từ ngày">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => updateFilter("dateFrom", event.target.value)}
                className="filter-control"
              />
            </FilterField>
            <FilterField label="Đến ngày">
              <input
                type="date"
                value={filters.dateTo}
                onChange={(event) => updateFilter("dateTo", event.target.value)}
                className="filter-control"
              />
            </FilterField>
            <button
              type="button"
              onClick={() => loadOrders({ ...filters, page: 1 })}
              className="min-h-11 rounded-lg bg-olive-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-olive-900 disabled:opacity-60"
              disabled={isLoading}
            >
              {isLoading ? "Đang lọc" : "Lọc"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {statusOptions.slice(0, 5).map((status) => (
              <button
                key={status.value || "all-chip"}
                type="button"
                disabled={isLoading}
                className={chipClass(filters.status === status.value)}
                onClick={() =>
                  loadOrders({ ...filters, status: status.value, page: 1 })
                }
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className={isLoading ? "opacity-60" : undefined}>
        <OrderTable orders={orders.items} permissions={permissions} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-olive-700/10 bg-white p-4 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          Hiển thị trang {orders.pagination.page}/{totalPages} ·{" "}
          {orders.pagination.totalItems} đơn
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-olive-700/15 px-3 py-2 font-bold disabled:text-muted"
            disabled={isLoading || orders.pagination.page <= 1}
            onClick={() => loadOrders({ ...filters, page: filters.page - 1 })}
          >
            Trước
          </button>
          <button
            type="button"
            className="rounded-lg border border-olive-700/15 px-3 py-2 font-bold disabled:text-muted"
            disabled={isLoading || orders.pagination.page >= totalPages}
            onClick={() => loadOrders({ ...filters, page: filters.page + 1 })}
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  );
}

function buildOrderQuery(filters: OrderFilters) {
  const query = new URLSearchParams();
  query.set("page", String(filters.page));
  query.set("pageSize", String(filters.pageSize));
  query.set("sortBy", filters.sortBy);
  query.set("sortDirection", filters.sortDirection);

  for (const key of ["search", "status", "dateFrom", "dateTo"] as const) {
    if (filters[key]) {
      query.set(key, filters[key]);
    }
  }

  return query;
}

function replaceUrl(pathname: string, query: URLSearchParams) {
  window.history.replaceState(null, "", `${pathname}?${query.toString()}`);
}

function chipClass(active: boolean) {
  return [
    "rounded-full px-3 py-1.5 text-xs font-bold transition",
    active
      ? "bg-olive-700 text-white"
      : "border border-olive-700/10 bg-beige-100 text-olive-900 hover:bg-beige-200"
  ].join(" ");
}

function FilterField({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className="px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
