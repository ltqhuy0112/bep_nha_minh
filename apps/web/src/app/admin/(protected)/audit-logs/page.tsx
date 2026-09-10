import { requirePermission } from "@/lib/admin/session";
import { listAdminAuditLogs } from "@bep-nha-minh/api/services/admin-audit-logs";
import { AuditLogTable } from "@/components/admin/audit-log-table";

type AuditLogSearchParams = Promise<Record<string, string | undefined>>;

export default async function AdminAuditLogsPage({
  searchParams
}: {
  searchParams: AuditLogSearchParams;
}) {
  await requirePermission("audit_logs.view");
  const params = await searchParams;
  const page = normalizePage(params.page);
  const logs = await listAdminAuditLogs({
    page,
    pageSize: 20,
    search: normalizeOptional(params.search),
    action: normalizeOptional(params.action),
    entityType: normalizeOptional(params.entityType),
    dateFrom: normalizeOptional(params.dateFrom),
    dateTo: normalizeOptional(params.dateTo)
  });

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-wood-500">
            Audit Logs
          </p>
          <h1 className="mt-2 font-serif text-4xl text-olive-900">
            Nhật ký kiểm toán
          </h1>
          <p className="mt-2 text-sm text-muted">
            Truy vết thao tác admin, seed data và các thay đổi nghiệp vụ quan trọng.
          </p>
        </div>
        <form className="rounded-lg border border-olive-700/10 bg-white p-3 shadow-sm">
          <div className="grid gap-2 xl:grid-cols-[minmax(220px,1.4fr)_auto_auto_auto_auto_auto] xl:items-end">
            <FilterField label="Tìm kiếm">
              <input
                name="search"
                placeholder="Action, actor, metadata"
                defaultValue={params.search}
                className="filter-control"
              />
            </FilterField>
            <FilterField label="Action">
              <input
                name="action"
                placeholder="orders.approve"
                defaultValue={params.action}
                className="filter-control"
              />
            </FilterField>
            <FilterField label="Entity">
              <input
                name="entityType"
                placeholder="order"
                defaultValue={params.entityType}
                className="filter-control"
              />
            </FilterField>
            <FilterField label="Từ ngày">
              <input
                name="dateFrom"
                type="date"
                defaultValue={params.dateFrom}
                className="filter-control"
              />
            </FilterField>
            <FilterField label="Đến ngày">
              <input
                name="dateTo"
                type="date"
                defaultValue={params.dateTo}
                className="filter-control"
              />
            </FilterField>
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-olive-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-olive-900"
            >
              Lọc
            </button>
          </div>
        </form>
      </div>

      <AuditLogTable logs={logs.items} />
      <PaginationFooter
        basePath="/admin/audit-logs"
        params={params}
        page={logs.pagination.page}
        totalItems={logs.pagination.totalItems}
        totalPages={logs.pagination.totalPages}
      />
    </div>
  );
}

function normalizePage(value: string | undefined) {
  const page = Number(value ?? 1);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function normalizeOptional(value: string | undefined) {
  return value?.trim() || undefined;
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

function PaginationFooter({
  basePath,
  params,
  page,
  totalItems,
  totalPages
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  totalItems: number;
  totalPages: number;
}) {
  const safeTotalPages = Math.max(totalPages, 1);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-olive-700/10 bg-white p-4 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p>
        Hiển thị trang {page}/{safeTotalPages} - {totalItems} logs
      </p>
      <div className="flex items-center gap-2">
        <PaginationLink
          basePath={basePath}
          params={params}
          page={Math.max(page - 1, 1)}
          label="Trước"
          disabled={page <= 1}
        />
        <PaginationLink
          basePath={basePath}
          params={params}
          page={page + 1}
          label="Sau"
          disabled={page >= safeTotalPages}
        />
      </div>
    </div>
  );
}

function PaginationLink({
  basePath,
  params,
  page,
  label,
  disabled = false
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  label: string;
  disabled?: boolean;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") {
      query.set(key, value);
    }
  }
  query.set("page", String(page));

  return disabled ? (
    <span className="rounded-lg border border-olive-700/10 px-3 py-2 text-muted">
      {label}
    </span>
  ) : (
    <a
      className="rounded-lg border border-olive-700/15 px-3 py-2 font-bold"
      href={`${basePath}?${query}`}
    >
      {label}
    </a>
  );
}
