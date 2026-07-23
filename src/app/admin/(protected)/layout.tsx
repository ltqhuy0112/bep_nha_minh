import type { ReactNode } from "react";
import { requireSession } from "@/lib/admin/session";
import { hasPermission } from "@/lib/admin/permissions";
import { signOutAdmin } from "./actions";

const navItems = [
  {
    label: "Tổng quan",
    href: "/admin",
    permission: "admin.dashboard.view"
  },
  {
    label: "Đơn hàng",
    href: "/admin/orders",
    permission: "orders.view"
  },
  {
    label: "Khách hàng",
    href: "/admin/customers",
    permission: "customers.view"
  },
  {
    label: "Audit logs",
    href: "/admin/audit-logs",
    permission: "audit_logs.view"
  }
] as const;

export default async function AdminProtectedLayout({
  children
}: {
  children: ReactNode;
}) {
  const session = await requireSession();
  const visibleNav = navItems.filter((item) =>
    hasPermission(session, item.permission)
  );

  return (
    <div className="min-h-screen bg-[#f7f3ea] text-olive-900">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-olive-700/10 bg-olive-900 p-5 text-cream-100 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
          <div>
            <p className="font-serif text-2xl">Bếp Nhà Mình</p>
            <p className="mt-1 text-sm text-cream-100/70">Admin Operations</p>
          </div>
          <nav
            className="mt-8 flex gap-2 overflow-x-auto lg:grid lg:overflow-visible"
            aria-label="Admin navigation"
          >
            {visibleNav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg px-4 py-3 text-sm font-semibold transition hover:bg-cream-100/10"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>
        <div>
          <header className="sticky top-0 z-20 flex flex-col gap-4 border-b border-olive-700/10 bg-white/90 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-muted">Đang đăng nhập</p>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-olive-900">
                  {session.user.name || session.user.email} -
                </p>
                <span className="rounded-lg bg-olive-700/10 px-3 py-1 text-xs font-bold text-olive-900">
                  {session.user.role}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <form action={signOutAdmin}>
                <button
                  type="submit"
                  className="rounded-lg border border-olive-700/20 px-4 py-2 text-sm font-semibold text-olive-900 transition hover:bg-olive-700/10"
                >
                  Đăng xuất
                </button>
              </form>
            </div>
          </header>
          <main className="p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
