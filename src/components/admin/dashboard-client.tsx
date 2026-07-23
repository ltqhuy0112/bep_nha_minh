"use client";

import { useMemo, useState } from "react";
import { OrderChart } from "@/components/admin/order-chart";
import { OrderTable } from "@/components/admin/order-table";
import { StatCard } from "@/components/admin/stat-card";
import type {
  AdminOrderListDto,
  OrderAnalyticsDto
} from "@/components/admin/client-types";
import { formatVnd } from "@/lib/admin/format";
import type { ApiResponse } from "@/lib/api-response";

type RangeMode = "1d" | "3d" | "7d";
type DashboardFilters = {
  range: RangeMode;
  dateFrom: string;
  dateTo: string;
  custom: boolean;
};

export function DashboardClient({
  initialAnalytics,
  recentOrders,
  pendingOrders,
  permissions,
  initialFilters
}: {
  initialAnalytics: OrderAnalyticsDto;
  recentOrders: AdminOrderListDto;
  pendingOrders: AdminOrderListDto;
  permissions: string[];
  initialFilters: DashboardFilters;
}) {
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [filters, setFilters] = useState(initialFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAnalytics(nextFilters: DashboardFilters) {
    setIsLoading(true);
    setError(null);

    try {
      const query = buildAnalyticsQuery(nextFilters);
      const response = await fetch(`/api/admin/analytics/orders?${query}`, {
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json()) as ApiResponse<OrderAnalyticsDto>;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success ? "Không thể tải thống kê." : payload.error.message
        );
      }

      setAnalytics(payload.data);
      setFilters(nextFilters);
      replaceUrl("/admin", query);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải thống kê."
      );
    } finally {
      setIsLoading(false);
    }
  }

  const activeLabel = useMemo(() => {
    if (filters.custom) {
      return `${filters.dateFrom || "..."} - ${filters.dateTo || "..."}`;
    }

    return filters.range === "1d"
      ? "1 ngày"
      : filters.range === "3d"
        ? "3 ngày"
        : "7 ngày";
  }, [filters]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-wood-500">
            Dashboard
          </p>
          <h1 className="mt-2 font-serif text-4xl text-olive-900">
            Tổng quan vận hành
          </h1>
        </div>
        <div className="w-full rounded-lg border border-olive-700/10 bg-white p-3 shadow-sm lg:w-auto">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <div>
              <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                Khoảng nhanh
              </p>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-beige-200/60 p-1">
                {(["1d", "3d", "7d"] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() =>
                      loadAnalytics({
                        range,
                        dateFrom: "",
                        dateTo: "",
                        custom: false
                      })
                    }
                    className={rangeButtonClass(!filters.custom && filters.range === range)}
                    disabled={isLoading}
                  >
                    {range === "1d" ? "1 ngày" : range === "3d" ? "3 ngày" : "7 ngày"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 rounded-lg border border-olive-700/10 bg-beige-100/60 p-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <DateField
                label="Từ ngày"
                value={filters.dateFrom}
                onChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    dateFrom: value,
                    custom: true
                  }))
                }
              />
              <DateField
                label="Đến ngày"
                value={filters.dateTo}
                onChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    dateTo: value,
                    custom: true
                  }))
                }
              />
              <button
                type="button"
                className="min-h-11 rounded-lg bg-olive-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-olive-900 disabled:opacity-60"
                disabled={isLoading || !filters.dateFrom || !filters.dateTo}
                onClick={() => loadAnalytics({ ...filters, custom: true })}
              >
                {isLoading ? "Đang tải" : "Lọc"}
              </button>
            </div>
          </div>
          <p className="mt-3 rounded-lg bg-beige-200/45 px-3 py-2 text-xs font-semibold text-olive-900">
            Đang xem: {activeLabel} · Asia/Ho_Chi_Minh
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className={isLoading ? "grid gap-6 opacity-60" : "grid gap-6"}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Tổng đơn" value={String(analytics.summary.totalOrders)} />
          <StatCard label="Chờ duyệt" value={String(analytics.summary.pendingOrders)} />
          <StatCard label="Hoàn tất" value={String(analytics.summary.completedOrders)} />
          <StatCard label="Doanh thu" value={formatVnd(analytics.summary.grossRevenue)} />
          <StatCard label="Đã duyệt" value={String(analytics.summary.approvedOrders)} />
          <StatCard label="Đã hủy" value={String(analytics.summary.cancelledOrders)} />
          <StatCard label="Giá trị TB" value={formatVnd(analytics.summary.averageOrderValue)} />
          <StatCard label="Tỷ lệ duyệt" value={`${analytics.summary.approvalRate}%`} />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <OrderChart title="Đơn hàng theo thời gian" points={analytics.series} metric="orders" />
          <OrderChart title="Doanh thu theo thời gian" points={analytics.series} metric="revenue" />
        </div>
      </div>

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-olive-900">Đơn mới nhất</h2>
          <a className="text-sm font-bold text-olive-700" href="/admin/orders">
            Xem tất cả
          </a>
        </div>
        <OrderTable orders={recentOrders.items} permissions={permissions} />
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-bold text-olive-900">Đang chờ duyệt</h2>
        <OrderTable orders={pendingOrders.items} permissions={permissions} />
      </section>
    </div>
  );
}

function buildAnalyticsQuery(filters: DashboardFilters) {
  const query = new URLSearchParams();

  if (filters.custom) {
    query.set("dateFrom", filters.dateFrom);
    query.set("dateTo", filters.dateTo);
  } else {
    query.set("range", filters.range);
  }

  return query;
}

function replaceUrl(pathname: string, query: URLSearchParams) {
  const search = query.toString();
  window.history.replaceState(null, "", search ? `${pathname}?${search}` : pathname);
}

function rangeButtonClass(active: boolean) {
  return [
    "min-h-10 rounded-md px-4 text-sm font-bold transition",
    active
      ? "bg-white text-olive-900 shadow-sm"
      : "text-muted hover:bg-white/70 hover:text-olive-900"
  ].join(" ");
}

function DateField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-lg border border-olive-700/15 bg-white px-3 text-sm font-semibold text-olive-900 outline-none transition focus:border-olive-700 focus:ring-2 focus:ring-olive-700/10"
      />
    </label>
  );
}
