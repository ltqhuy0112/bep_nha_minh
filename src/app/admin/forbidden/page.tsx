import { requireSession } from "@/lib/admin/session";

export default async function AdminForbiddenPage() {
  await requireSession();

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <section className="w-full max-w-lg rounded-[28px] border border-olive-700/10 bg-cream-100 p-7 text-center shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-wood-500">
          403
        </p>
        <h1 className="mt-3 font-serif text-4xl text-olive-900">
          Không đủ quyền truy cập
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted">
          Tài khoản của bạn đã đăng nhập nhưng chưa có quyền cho khu vực này.
        </p>
        <a
          href="/admin"
          className="mt-6 inline-flex rounded-full bg-olive-700 px-5 py-3 text-sm font-semibold text-cream-100"
        >
          Quay lại admin
        </a>
      </section>
    </main>
  );
}
