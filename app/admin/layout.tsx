"use client";

import Link from "next/link";
import { DEPOSIT_ACCOUNT } from "@/lib/constants";
import AdminAuthGuard from "@/components/AdminAuthGuard";
import WagmiProvider from "@/components/WagmiProvider";
import { useAccount, useDisconnect } from "wagmi";

function AdminLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-primary p-3 rounded-lg">
              <span className="text-2xl font-bold text-slate-900">/s</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Admin Panel
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Send Token Platform
              </p>
            </div>
          </div>

          {/* Wallet Info */}
          {address && (
            <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Connected Wallet</p>
              <p className="text-xs font-mono text-slate-900 dark:text-slate-100 truncate">
                {address.slice(0, 6)}...{address.slice(-4)}
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

          <nav className="space-y-2">
            <Link
              href="/admin"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-icons-outlined">dashboard</span>
              <span>Dashboard</span>
            </Link>
            <Link
              href="/admin/transactions"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-icons-outlined">receipt_long</span>
              <span>Transactions</span>
            </Link>
            <Link
              href="/admin/payments"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-icons-outlined">payment</span>
              <span>Payments</span>
            </Link>
            <Link
              href="/admin/token-distribution"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-icons-outlined">account_balance_wallet</span>
              <span>Token Distribution</span>
            </Link>
            <Link
              href="/admin/test-transfer"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-icons-outlined">send</span>
              <span>Test Transfer</span>
            </Link>
            <Link
              href="/admin/settings"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-icons-outlined">settings</span>
              <span>Settings</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mt-4"
            >
              <span className="material-icons-outlined">arrow_back</span>
              <span>Back to App</span>
            </Link>
          </nav>
        </div>

        {/* Account Info */}
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-slate-200 dark:border-slate-700">
          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Deposit Account
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {DEPOSIT_ACCOUNT.name}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {DEPOSIT_ACCOUNT.accountNumber} • {DEPOSIT_ACCOUNT.bank}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 p-8">{children}</main>
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

