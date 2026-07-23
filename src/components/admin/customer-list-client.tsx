"use client";

import { useState } from "react";
import { CustomerTable } from "@/components/admin/customer-table";
import type { AdminCustomerListDto } from "@/components/admin/client-types";
import type { ApiResponse } from "@/lib/api-response";

type CustomerFilters = {
  page: number;
  pageSize: number;
  search: string;
  dateFrom: string;
  dateTo: string;
};

export function CustomerListClient({
  initialCustomers,
  initialFilters
}: {
  initialCustomers: AdminCustomerListDto;
  initialFilters: CustomerFilters;
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [filters, setFilters] = useState(initialFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCustomers(nextFilters: CustomerFilters) {
    setIsLoading(true);
    setError(null);

    try {
      const query = buildCustomerQuery(nextFilters);
      const response = await fetch(`/api/admin/customers?${query}`, {
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json()) as ApiResponse<AdminCustomerListDto>;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success ? "Không thể tải khách hàng." : payload.error.message
        );
      }

      setCustomers(payload.data);
      setFilters(nextFilters);
      replaceUrl("/admin/customers", query);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải khách hàng."
      );
    } finally {
      setIsLoading(false);
    }
  }

  const totalPages = Math.max(customers.pagination.totalPages, 1);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-wood-500">
            Customers
          </p>
          <h1 className="mt-2 font-serif text-4xl text-olive-900">Khách hàng</h1>
        </div>
        <div className="w-full rounded-lg border border-olive-700/10 bg-white p-3 shadow-sm lg:w-auto">
          <div className="grid gap-2 xl:grid-cols-[minmax(220px,1.5fr)_auto_auto_auto] xl:items-end">
            <FilterField label="Tìm kiếm">
              <input
                placeholder="Tên, SĐT, email"
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, search: event.target.value }))
                }
                className="filter-control"
              />
            </FilterField>
            <FilterField label="Từ ngày">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, dateFrom: event.target.value }))
                }
                className="filter-control"
              />
            </FilterField>
            <FilterField label="Đến ngày">
              <input
                type="date"
                value={filters.dateTo}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, dateTo: event.target.value }))
                }
                className="filter-control"
              />
            </FilterField>
            <button
              type="button"
              className="min-h-11 rounded-lg bg-olive-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-olive-900 disabled:opacity-60"
              disabled={isLoading}
              onClick={() => loadCustomers({ ...filters, page: 1 })}
            >
              {isLoading ? "Đang lọc" : "Lọc"}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className={isLoading ? "opacity-60" : undefined}>
        <CustomerTable customers={customers.items} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-olive-700/10 bg-white p-4 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          Hiển thị trang {customers.pagination.page}/{totalPages} ·{" "}
          {customers.pagination.totalItems} khách hàng
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-olive-700/15 px-3 py-2 font-bold disabled:text-muted"
            disabled={isLoading || customers.pagination.page <= 1}
            onClick={() => loadCustomers({ ...filters, page: filters.page - 1 })}
          >
            Trước
          </button>
          <button
            type="button"
            className="rounded-lg border border-olive-700/15 px-3 py-2 font-bold disabled:text-muted"
            disabled={isLoading || customers.pagination.page >= totalPages}
            onClick={() => loadCustomers({ ...filters, page: filters.page + 1 })}
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  );
}

function buildCustomerQuery(filters: CustomerFilters) {
  const query = new URLSearchParams();
  query.set("page", String(filters.page));
  query.set("pageSize", String(filters.pageSize));

  for (const key of ["search", "dateFrom", "dateTo"] as const) {
    if (filters[key]) {
      query.set(key, filters[key]);
    }
  }

  return query;
}

function replaceUrl(pathname: string, query: URLSearchParams) {
  window.history.replaceState(null, "", `${pathname}?${query.toString()}`);
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
