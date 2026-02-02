/**
 * Admin route → permission mapping.
 * Each tab has its own permission so admins can be granted access per tab.
 * Super admin has access to all; other admins need the listed permission.
 */
export const ADMIN_ROUTE_PERMISSION: Record<string, string> = {
  "/admin": "view_dashboard",
  "/admin/onramp": "manage_onramp",
  "/admin/transactions": "manage_transactions",
  "/admin/payments": "verify_payments",
  "/admin/invoices": "manage_invoices",
  "/admin/users": "manage_users",
  "/admin/referrals": "view_referrals",
  "/admin/token-distribution": "manage_token_distribution",
  "/admin/utility": "manage_utility",
  "/admin/test-transfer": "test_transfers",
  "/admin/token-prices": "manage_token_prices",
  "/admin/price-action": "manage_price_action",
  "/admin/banners": "manage_banners",
  "/admin/offramp": "manage_offramp",
  "/admin/kyc": "manage_kyc",
  "/admin/settings": "manage_settings",
};

/** Legacy permissions: when an admin has these, they get the listed granular permissions too (for backward compatibility). */
const LEGACY_PERMISSION_EXPANSION: Record<string, string[]> = {
  manage_transactions: ["manage_onramp", "manage_transactions", "manage_invoices", "manage_offramp"],
  manage_settings: ["manage_utility", "manage_token_prices", "manage_price_action", "manage_banners", "manage_settings"],
  manage_users: ["manage_users", "manage_kyc"],
};

/** Expand legacy permissions so existing admins keep access to all tabs that were previously covered. */
export function getEffectivePermissions(permissions: string[]): string[] {
  const set = new Set<string>(permissions);
  for (const p of permissions) {
    const expanded = LEGACY_PERMISSION_EXPANSION[p];
    if (expanded) expanded.forEach((e) => set.add(e));
  }
  return Array.from(set);
}

export type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
  permission: string;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", permission: "view_dashboard" },
  { href: "/admin/onramp", label: "Onramp", icon: "arrow_downward", permission: "manage_onramp" },
  { href: "/admin/transactions", label: "All Transactions", icon: "receipt_long", permission: "manage_transactions" },
  { href: "/admin/payments", label: "Payments", icon: "payment", permission: "verify_payments" },
  { href: "/admin/invoices", label: "Invoices", icon: "description", permission: "manage_invoices" },
  { href: "/admin/users", label: "Users", icon: "people", permission: "manage_users" },
  { href: "/admin/referrals", label: "Referrals", icon: "group_add", permission: "view_referrals" },
  { href: "/admin/token-distribution", label: "Token Distribution", icon: "account_balance_wallet", permission: "manage_token_distribution" },
  { href: "/admin/utility", label: "Utility", icon: "build", permission: "manage_utility" },
  { href: "/admin/test-transfer", label: "Test Transfer", icon: "send", permission: "test_transfers" },
  { href: "/admin/token-prices", label: "Token Prices", icon: "attach_money", permission: "manage_token_prices" },
  { href: "/admin/price-action", label: "Price Action", icon: "trending_up", permission: "manage_price_action" },
  { href: "/admin/banners", label: "Banners", icon: "image", permission: "manage_banners" },
  { href: "/admin/offramp", label: "Offramp", icon: "arrow_upward", permission: "manage_offramp" },
  { href: "/admin/kyc", label: "KYC Management", icon: "verified_user", permission: "manage_kyc" },
  { href: "/admin/settings", label: "Settings", icon: "settings", permission: "manage_settings" },
];

/** All grantable permissions (one per tab). Use this for Add/Edit Admin forms. */
export const ALL_ADMIN_PERMISSIONS: string[] = [
  "view_dashboard",
  "manage_onramp",
  "manage_transactions",
  "verify_payments",
  "manage_invoices",
  "manage_users",
  "view_referrals",
  "manage_token_distribution",
  "manage_utility",
  "test_transfers",
  "manage_token_prices",
  "manage_price_action",
  "manage_banners",
  "manage_offramp",
  "manage_kyc",
  "manage_settings",
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
  const effective = getEffectivePermissions(permissions);
  return effective.includes(required);
}

export function filterNavByPermission(
  items: AdminNavItem[],
  role: "super_admin" | "admin" | undefined,
  permissions: string[]
): AdminNavItem[] {
  if (!role) return [];
  if (role === "super_admin") return items;
  const effective = getEffectivePermissions(permissions);
  return items.filter((item) => effective.includes(item.permission));
}
