export const adminRoles = [
  "SUPER_ADMIN",
  "ADMIN",
  "ORDER_MANAGER",
  "VIEWER"
] as const;

export type AdminRole = (typeof adminRoles)[number];

export const adminPermissions = [
  "admin.dashboard.view",
  "orders.view",
  "orders.approve",
  "orders.reject",
  "orders.cancel",
  "orders.update_status",
  "customers.view",
  "analytics.view",
  "audit_logs.view",
  "admins.manage"
] as const;

export type AdminPermission = (typeof adminPermissions)[number];

const permissionMap: Record<AdminRole, AdminPermission[]> = {
  SUPER_ADMIN: [...adminPermissions],
  ADMIN: [
    "admin.dashboard.view",
    "orders.view",
    "orders.approve",
    "orders.reject",
    "orders.cancel",
    "orders.update_status",
    "customers.view",
    "analytics.view",
    "audit_logs.view"
  ],
  ORDER_MANAGER: [
    "admin.dashboard.view",
    "orders.view",
    "orders.approve",
    "orders.reject",
    "orders.update_status",
    "customers.view",
    "analytics.view"
  ],
  VIEWER: [
    "admin.dashboard.view",
    "orders.view",
    "customers.view",
    "analytics.view"
  ]
};

export function isAdminRole(value: string): value is AdminRole {
  return adminRoles.includes(value as AdminRole);
}

export function getPermissionsForRole(role: AdminRole) {
  return permissionMap[role];
}

export function hasPermission(
  session: { user?: { role?: string | null } } | null,
  permission: AdminPermission
) {
  const role = session?.user?.role;
  if (!role || !isAdminRole(role)) {
    return false;
  }

  return permissionMap[role].includes(permission);
}
