"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DEPOSIT_ACCOUNT } from "@/lib/constants";
import AdminAuthGuard from "@/components/AdminAuthGuard";
import WagmiProvider from "@/components/WagmiProvider";
import PoweredBySEND from "@/components/PoweredBySEND";
import ThemeToggle from "@/components/ThemeToggle";
import { useAccount, useDisconnect } from "wagmi";
import {
  ADMIN_NAV_ITEMS,
  canAccessRoute,
  filterNavByPermission,
} from "@/lib/admin-permissions";

function AdminLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [role, setRole] = useState<"super_admin" | "admin" | undefined>(undefined);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loadingMe, setLoadingMe] = useState(true);

  useEffect(() => {
    if (!address) {
      setRole(undefined);
      setPermissions([]);
      setLoadingMe(false);
      return;
    }
    let cancelled = false;
    setLoadingMe(true);
    fetch("/api/admin/me", {
      headers: { Authorization: `Bearer ${address}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          setRole(data.role ?? "admin");
          setPermissions(Array.isArray(data.permissions) ? data.permissions : []);
        } else {
          setRole("admin");
          setPermissions([]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRole("admin");
          setPermissions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMe(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const allowedNavItems = filterNavByPermission(ADMIN_NAV_ITEMS, role, permissions);
  const canAccessCurrentPage = canAccessRoute(pathname ?? "", role, permissions);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark" style={{ backgroundColor: "var(--background-light)" }}>
      <style jsx global>{`
        :root {
          --background-light: #FFFFFF;
          --background-dark: #011931;
        }
        .dark {
          --background-light: #011931;
        }
      `}</style>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-white dark:bg-slate-900 p-2 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700"
        aria-label="Toggle menu"
      >
        <span className="material-icons-outlined text-slate-900 dark:text-slate-100">
          {sidebarOpen ? "close" : "menu"}
        </span>
      </button>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background-dark/80 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-72 sm:w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Close Button for Mobile */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 lg:hidden">
          <div className="flex items-center gap-3">
            <div>
              {/* White logo for light mode */}
              <img 
                src="/whitelogo.png" 
                alt="FlipPay" 
                className="h-10 w-auto dark:hidden"
              />
              {/* Regular logo for dark mode */}
              <img 
                src="/logo.png" 
                alt="FlipPay" 
                className="h-10 w-auto hidden dark:block"
              />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Admin Panel
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                FlipPay Platform
              </p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close menu"
          >
            <span className="material-icons-outlined text-slate-900 dark:text-slate-100">close</span>
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-4 sm:p-6">
            {/* Header for Desktop */}
            <div className="hidden lg:flex items-center gap-3 mb-6 sm:mb-8">
              <div>
                {/* White logo for light mode */}
                <img 
                  src="/whitelogo.png" 
                  alt="FlipPay" 
                  className="h-12 w-auto dark:hidden"
                />
                {/* Regular logo for dark mode */}
                <img 
                  src="/logo.png" 
                  alt="FlipPay" 
                  className="h-12 w-auto hidden dark:block"
                />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Admin Panel
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  FlipPay Platform
                </p>
              </div>
            </div>

            {/* Wallet Info */}
            {address && (
              <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Connected Wallet</p>
                <p className="text-xs font-mono text-slate-900 dark:text-slate-100 break-all">
                  {address.slice(0, 8)}...{address.slice(-6)}
                </p>
                <button
                  onClick={() => {
                    disconnect();
                    localStorage.removeItem("admin_session");
                    localStorage.removeItem("admin_wallet");
                    window.location.href = "/admin";
                  }}
                  className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  Disconnect
                </button>
              </div>
            )}

            <nav className="space-y-1 sm:space-y-2">
              {loadingMe ? (
                <div className="flex items-center gap-2 py-3 text-slate-500 dark:text-slate-400 text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                  <span>Loading access...</span>
                </div>
              ) : (
                allowedNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base transition-colors ${
                      pathname === item.href
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="material-icons-outlined text-lg sm:text-xl">{item.icon}</span>
                    <span className={item.label === "Token Distribution" ? "whitespace-nowrap" : ""}>{item.label}</span>
                  </Link>
                ))
              )}
              {/* Theme Toggle */}
              <div className="mt-2 sm:mt-4" onClick={() => setSidebarOpen(false)}>
                <ThemeToggle />
              </div>
              <Link
                href="/"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mt-2 sm:mt-4"
              >
                <span className="material-icons-outlined text-lg sm:text-xl">arrow_back</span>
                <span>Back to App</span>
              </Link>
            </nav>
          </div>
        </div>

        {/* Account Info - Fixed at bottom */}
        <div className="flex-shrink-0 p-4 sm:p-6 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="bg-slate-100 dark:bg-slate-800 p-3 sm:p-4 rounded-lg mb-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 sm:mb-2">
              Deposit Account
            </p>
            <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 break-words">
              {DEPOSIT_ACCOUNT.name}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {DEPOSIT_ACCOUNT.accountNumber} • {DEPOSIT_ACCOUNT.bank}
            </p>
          </div>
          <PoweredBySEND />
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 xl:ml-80 p-4 sm:p-6 lg:p-8 pt-16 sm:pt-20 lg:pt-8 min-h-screen">
        {!loadingMe && pathname && !canAccessCurrentPage ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <span className="material-icons-outlined text-6xl text-slate-400 dark:text-slate-500 mb-4">lock</span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Access denied</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4 max-w-md">
              You don&apos;t have permission to view this page. Contact a super admin to request access.
            </p>
            <Link
              href="/admin"
              className="px-4 py-2 rounded-lg bg-primary text-slate-900 font-medium hover:opacity-90"
            >
              Back to Dashboard
            </Link>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WagmiProvider>
      <AdminAuthGuard>
        <AdminLayoutContent>{children}</AdminLayoutContent>
      </AdminAuthGuard>
    </WagmiProvider>
  );
}

