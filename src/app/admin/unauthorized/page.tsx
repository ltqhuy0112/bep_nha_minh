export default function AdminUnauthorizedPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <section className="w-full max-w-lg rounded-[28px] border border-olive-700/10 bg-cream-100 p-7 text-center shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-wood-500">
          401
        </p>
        <h1 className="mt-3 font-serif text-4xl text-olive-900">
          Cần đăng nhập
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted">
          Vui lòng đăng nhập bằng tài khoản admin để tiếp tục.
        </p>
        <a
          href="/admin/login"
          className="mt-6 inline-flex rounded-full bg-olive-700 px-5 py-3 text-sm font-semibold text-cream-100"
        >
          Đăng nhập
        </a>
      </section>
    </main>
  );
}
