import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminLoginForm } from "./login-form";

export default async function AdminLoginPage() {
  const session = await auth();

  if (session?.user?.id) {
    redirect("/admin");
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <section className="w-full max-w-md rounded-[28px] border border-olive-700/10 bg-cream-100 p-7 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-wood-500">
          Admin
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-olive-900">
          Đăng nhập quản trị
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Khu vực này chỉ dành cho nhân sự được cấp quyền của Bếp Nhà Mình.
        </p>
        <div className="mt-7">
          <AdminLoginForm />
        </div>
      </section>
    </main>
  );
}
