import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { AdminPermission } from "@bep-nha-minh/api/lib/admin/permissions";
import { hasPermission } from "@bep-nha-minh/api/lib/admin/permissions";
import { errorResponse } from "@bep-nha-minh/api/lib/api-response";

export class AdminUnauthorizedError extends Error {
  constructor() {
    super("Admin session is required.");
    this.name = "AdminUnauthorizedError";
  }
}

export class AdminForbiddenError extends Error {
  constructor(permission: AdminPermission) {
    super(`Admin permission is required: ${permission}`);
    this.name = "AdminForbiddenError";
  }
}

export async function requireSession(options: { redirectToLogin?: boolean } = {}) {
  const session = await auth();

  if (!session?.user?.id) {
    if (options.redirectToLogin ?? true) {
      redirect("/admin/login");
    }

    throw new AdminUnauthorizedError();
  }

  return session;
}

export async function requirePermission(
  permission: AdminPermission,
  options: { redirectOnForbidden?: boolean; redirectToLogin?: boolean } = {}
) {
  const session = await requireSession({
    redirectToLogin: options.redirectToLogin
  });

  if (!hasPermission(session, permission)) {
    if (options.redirectOnForbidden ?? true) {
      redirect("/admin/forbidden");
    }

    throw new AdminForbiddenError(permission);
  }

  return session;
}

export function adminAuthErrorResponse(error: unknown) {
  if (error instanceof AdminUnauthorizedError) {
    return errorResponse("UNAUTHORIZED", "Admin session is required.", 401);
  }

  if (error instanceof AdminForbiddenError) {
    return errorResponse("FORBIDDEN", "Permission denied.", 403);
  }

  return null;
}
