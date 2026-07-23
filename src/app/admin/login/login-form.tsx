"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { loginAdmin } from "./actions";

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(loginAdmin, {});

  return (
    <form action={formAction} className="grid gap-5">
      <label className="grid gap-2 text-sm font-semibold text-olive-900">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="min-h-12 rounded-2xl border border-olive-700/15 bg-white px-4 text-base text-olive-900 outline-none transition focus:border-olive-700 focus:ring-4 focus:ring-olive-700/10"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-olive-900">
        Mật khẩu
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-12 rounded-2xl border border-olive-700/15 bg-white px-4 text-base text-olive-900 outline-none transition focus:border-olive-700 focus:ring-4 focus:ring-olive-700/10"
        />
      </label>
      {state.error ? (
        <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>
    </form>
  );
}
