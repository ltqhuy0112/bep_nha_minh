"use server";

import { signOut } from "@/auth";

export async function signOutAdmin() {
  await signOut({ redirectTo: "/admin/login" });
}
