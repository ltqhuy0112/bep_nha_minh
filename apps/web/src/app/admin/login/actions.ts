"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type AdminLoginState = {
  error?: string;
};

export async function loginAdmin(
  _previousState: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/admin"
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: "Email hoặc mật khẩu không đúng."
      };
    }

    throw error;
  }

  return {};
}
