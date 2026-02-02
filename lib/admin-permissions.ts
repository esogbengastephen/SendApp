/**
 * Admin route → permission mapping.
 * Used by admin layout (sidebar) and can be used by API/page guards.
 * Super admin has access to all; other admins need the listed permission.
 */
export const ADMIN_ROUTE_PERMISSION: Record<string, string> = {
  "/admin": "view_dashboard",
  "/admin/onramp": "manage_transactions",
  "/admin/transactions": "manage_transactions",
  "/admin/payments": "verify_payments",
  "/admin/invoices": "manage_transactions",
  "/admin/users": "manage_users",
  "/admin/referrals": "view_referrals",
  "/admin/token-distribution": "manage_token_distribution",
  "/admin/utility": "manage_settings",
  "/admin/test-transfer": "test_transfers",
  "/admin/token-prices": "manage_settings",
  "/admin/price-action": "manage_settings",
  "/admin/banners": "manage_settings",
  "/admin/offramp": "manage_transactions",
  "/admin/kyc": "manage_users",
  "/admin/settings": "manage_settings",
};

export type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
  permission: string;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", permission: "view_dashboard" },
  { href: "/admin/onramp", label: "Onramp", icon: "arrow_downward", permission: "manage_transactions" },
  { href: "/admin/transactions", label: "All Transactions", icon: "receipt_long", permission: "manage_transactions" },
  { href: "/admin/payments", label: "Payments", icon: "payment", permission: "verify_payments" },
  { href: "/admin/invoices", label: "Invoices", icon: "description", permission: "manage_transactions" },
  { href: "/admin/users", label: "Users", icon: "people", permission: "manage_users" },
  { href: "/admin/referrals", label: "Referrals", icon: "group_add", permission: "view_referrals" },
  { href: "/admin/token-distribution", label: "Token Distribution", icon: "account_balance_wallet", permission: "manage_token_distribution" },
  { href: "/admin/utility", label: "Utility", icon: "build", permission: "manage_settings" },
  { href: "/admin/test-transfer", label: "Test Transfer", icon: "send", permission: "test_transfers" },
  { href: "/admin/token-prices", label: "Token Prices", icon: "attach_money", permission: "manage_settings" },
  { href: "/admin/price-action", label: "Price Action", icon: "trending_up", permission: "manage_settings" },
  { href: "/admin/banners", label: "Banners", icon: "image", permission: "manage_settings" },
  { href: "/admin/offramp", label: "Offramp", icon: "arrow_upward", permission: "manage_transactions" },
  { href: "/admin/kyc", label: "KYC Management", icon: "verified_user", permission: "manage_users" },
  { href: "/admin/settings", label: "Settings", icon: "settings", permission: "manage_settings" },
];

/** Get required permission for a pathname (handles subpaths e.g. /admin/invoices/123 → manage_transactions). */
export function getRequiredPermissionForPath(pathname: string): string | undefined {
  if (ADMIN_ROUTE_PERMISSION[pathname]) return ADMIN_ROUTE_PERMISSION[pathname];
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "admin" && segments[1]) {
    const basePath = "/admin/" + segments[1];
    return ADMIN_ROUTE_PERMISSION[basePath];
  }
  return undefined;
}

export function canAccessRoute(
  pathname: string,
  role: "super_admin" | "admin" | undefined,
  permissions: string[]
): boolean {
  if (!role) return false;
  if (role === "super_admin") return true;
  const required = getRequiredPermissionForPath(pathname);
  if (!required) return true; // unknown route, allow
  return permissions.includes(required);
}

export function filterNavByPermission(
  items: AdminNavItem[],
  role: "super_admin" | "admin" | undefined,
  permissions: string[]
): AdminNavItem[] {
  if (!role) return [];
  if (role === "super_admin") return items;
  return items.filter((item) => permissions.includes(item.permission));
}
