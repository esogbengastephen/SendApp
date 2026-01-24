"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface OfframpTransaction {
  id: string;
  transaction_id: string;
  user_id: string;
  user_email?: string;
  wallet_address: string;
  smart_wallet_address?: string;
  solana_wallet_address?: string;
  network: string;
  token_symbol?: string;
  token_amount?: string;
  usdc_amount?: string;
  ngn_amount?: number;
  status: string;
  swap_tx_hash?: string;
  paystack_reference?: string;
  error_message?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const COLORS = {
  primary: "#00BFFF",
  backgroundDark: "#011931",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
};

const STATUS_COLORS: Record<string, string> = {
  completed: COLORS.success,
  pending: COLORS.warning,
  token_received: COLORS.info,
  swapping: COLORS.info,
  usdc_received: COLORS.info,
  paying: COLORS.info,
  failed: COLORS.error,
  refunded: COLORS.warning,
};

export default function OfframpTransactionsPage() {
  const [transactions, setTransactions] = useState<OfframpTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "",
    network: "",
    token: "",
  });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    fetchTransactions();
  }, [filters, pagination.page]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filters.status) {
        params.append("status", filters.status);
      }

      if (filters.network) {
        params.append("network", filters.network);
      }

      if (filters.token) {
        params.append("token", filters.token);
      }

      const response = await fetch(`/api/admin/offramp?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setTransactions(data.transactions);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    return STATUS_COLORS[status] || COLORS.info;
  };

  const formatStatus = (status: string) => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getExplorerUrl = (network: string, txHash?: string) => {
    if (!txHash) return null;
    if (network === "base") {
      return `https://basescan.org/tx/${txHash}`;
    } else if (network === "solana") {
      return `https://solscan.io/tx/${txHash}`;
    }
    return null;
  };

  const stats = {
    total: pagination.total,
    completed: transactions.filter((t) => t.status === "completed").length,
    pending: transactions.filter((t) => ["pending", "token_received", "swapping", "usdc_received", "paying"].includes(t.status)).length,
    failed: transactions.filter((t) => t.status === "failed").length,
    base: transactions.filter((t) => t.network === "base").length,
    solana: transactions.filter((t) => t.network === "solana").length,
  };

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <style jsx global>{`
        :root {
          --background-light: #FFFFFF;
          --background-dark: #011931;
        }
        .dark {
          --background-light: #011931;
        }
      `}</style>

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary dark:text-text-primary-dark">
          Offramp Transactions
        </h1>
        <p className="text-sm sm:text-base text-medium-grey dark:text-light-grey mt-1 sm:mt-2">
          Monitor crypto-to-fiat conversion transactions
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
          <p className="text-sm text-medium-grey dark:text-light-grey mb-2">Total Transactions</p>
          <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
            {loading ? "..." : stats.total.toLocaleString()}
          </p>
        </div>

        <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
          <p className="text-sm text-medium-grey dark:text-light-grey mb-2">Completed</p>
          <p className="text-2xl font-bold text-success">{loading ? "..." : stats.completed}</p>
        </div>

        <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
          <p className="text-sm text-medium-grey dark:text-light-grey mb-2">Pending</p>
          <p className="text-2xl font-bold text-warning">{loading ? "..." : stats.pending}</p>
        </div>

        <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
          <p className="text-sm text-medium-grey dark:text-light-grey mb-2">Failed</p>
          <p className="text-2xl font-bold text-error">{loading ? "..." : stats.failed}</p>
        </div>
      </div>

      {/* Network Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
          <p className="text-sm text-medium-grey dark:text-light-grey mb-2">Base Network</p>
          <p className="text-2xl font-bold text-primary">{loading ? "..." : stats.base}</p>
        </div>

        <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
          <p className="text-sm text-medium-grey dark:text-light-grey mb-2">Solana Network</p>
          <p className="text-2xl font-bold text-primary">{loading ? "..." : stats.solana}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => {
                setFilters({ ...filters, status: e.target.value });
                setPagination({ ...pagination, page: 1 });
              }}
              className="w-full px-4 py-2 rounded-lg border border-light-grey dark:border-medium-grey bg-white dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
              style={{ "--focus-ring-color": COLORS.primary } as React.CSSProperties}
              aria-label="Filter by transaction status"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="token_received">Token Received</option>
              <option value="swapping">Swapping</option>
              <option value="usdc_received">USDC Received</option>
              <option value="paying">Paying</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
              Network
            </label>
            <select
              value={filters.network}
              onChange={(e) => {
                setFilters({ ...filters, network: e.target.value });
                setPagination({ ...pagination, page: 1 });
              }}
              className="w-full px-4 py-2 rounded-lg border border-light-grey dark:border-medium-grey bg-white dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
              style={{ "--focus-ring-color": COLORS.primary } as React.CSSProperties}
              aria-label="Filter by network"
            >
              <option value="">All Networks</option>
              <option value="base">Base</option>
              <option value="solana">Solana</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-2">
              Token Symbol
            </label>
            <input
              type="text"
              value={filters.token}
              onChange={(e) => {
                setFilters({ ...filters, token: e.target.value });
                setPagination({ ...pagination, page: 1 });
              }}
              placeholder="e.g., USDC, ETH"
              className="w-full px-4 py-2 rounded-lg border border-light-grey dark:border-medium-grey bg-white dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
              style={{ "--focus-ring-color": COLORS.primary } as React.CSSProperties}
            />
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-lg border border-light-grey dark:border-medium-grey overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-light-blue dark:bg-background-dark">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary dark:text-text-primary-dark uppercase tracking-wider">
                  Transaction ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary dark:text-text-primary-dark uppercase tracking-wider">
                  Network
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary dark:text-text-primary-dark uppercase tracking-wider">
                  Token
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary dark:text-text-primary-dark uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary dark:text-text-primary-dark uppercase tracking-wider">
                  NGN Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary dark:text-text-primary-dark uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary dark:text-text-primary-dark uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary dark:text-text-primary-dark uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-grey dark:divide-medium-grey">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-medium-grey dark:text-light-grey">
                    Loading...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-medium-grey dark:text-light-grey">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const explorerUrl = getExplorerUrl(tx.network, tx.swap_tx_hash);
                  return (
                    <tr key={tx.id} className="hover:bg-light-blue dark:hover:bg-background-dark transition-colors">
                      <td className="px-4 py-4">
                        <p className="text-sm font-mono text-text-primary dark:text-text-primary-dark">
                          {tx.transaction_id.slice(0, 12)}...
                        </p>
                        {tx.user_email && (
                          <p className="text-xs text-medium-grey dark:text-light-grey mt-1">
                            {tx.user_email}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 rounded text-xs font-semibold text-white capitalize" style={{ backgroundColor: tx.network === "base" ? COLORS.primary : COLORS.info }}>
                          {tx.network}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-text-primary dark:text-text-primary-dark">
                          {tx.token_symbol || "N/A"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-text-primary dark:text-text-primary-dark">
                          {tx.token_amount || "N/A"}
                        </p>
                        {tx.usdc_amount && (
                          <p className="text-xs text-medium-grey dark:text-light-grey">
                            USDC: {tx.usdc_amount}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                          ₦{tx.ngn_amount?.toLocaleString() || "0"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className="px-2 py-1 rounded text-xs font-semibold text-white capitalize"
                          style={{ backgroundColor: getStatusBadgeColor(tx.status) }}
                        >
                          {formatStatus(tx.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-xs text-medium-grey dark:text-light-grey">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-medium-grey dark:text-light-grey">
                          {new Date(tx.created_at).toLocaleTimeString()}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          {explorerUrl && (
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs hover:underline"
                              style={{ color: COLORS.primary }}
                            >
                              View on Explorer →
                            </a>
                          )}
                          {tx.paystack_reference && (
                            <p className="text-xs text-medium-grey dark:text-light-grey">
                              Ref: {tx.paystack_reference.slice(0, 8)}...
                            </p>
                          )}
                          {tx.error_message && (
                            <p className="text-xs text-error" title={tx.error_message}>
                              Error: {tx.error_message.slice(0, 30)}...
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-4 border-t border-light-grey dark:border-medium-grey flex items-center justify-between">
            <div className="text-sm text-medium-grey dark:text-light-grey">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} transactions
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
                className="px-4 py-2 rounded-lg border border-light-grey dark:border-medium-grey text-text-primary dark:text-text-primary-dark disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page >= pagination.totalPages}
                className="px-4 py-2 rounded-lg border border-light-grey dark:border-medium-grey text-text-primary dark:text-text-primary-dark disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
