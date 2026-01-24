"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface OnrampTransaction {
  id: string;
  transaction_id: string;
  paystack_reference?: string;
  wallet_address: string;
  ngn_amount: number;
  send_amount: string;
  status: string;
  exchange_rate?: number;
  sendtag?: string;
  created_at: string;
  completed_at?: string;
  tx_hash?: string;
  error_message?: string;
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
  failed: COLORS.error,
};

export default function OnrampTransactionsPage() {
  const [transactions, setTransactions] = useState<OnrampTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "",
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

      const response = await fetch(`/api/admin/onramp?${params.toString()}`);
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
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const stats = {
    total: pagination.total,
    completed: transactions.filter((t) => t.status === "completed").length,
    pending: transactions.filter((t) => t.status === "pending").length,
    failed: transactions.filter((t) => t.status === "failed").length,
    totalRevenue: transactions
      .filter((t) => t.status === "completed")
      .reduce((sum, t) => sum + parseFloat(t.ngn_amount?.toString() || "0"), 0),
    totalTokensDistributed: transactions
      .filter((t) => t.status === "completed" && t.tx_hash)
      .reduce((sum, t) => sum + parseFloat(t.send_amount || "0"), 0),
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
          Onramp Transactions
        </h1>
        <p className="text-sm sm:text-base text-medium-grey dark:text-light-grey mt-1 sm:mt-2">
          Monitor Naira-to-Crypto conversion transactions (Base Network)
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

      {/* Revenue Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
          <p className="text-sm text-medium-grey dark:text-light-grey mb-2">Total Revenue (NGN)</p>
          <p className="text-2xl font-bold text-primary">₦{loading ? "..." : stats.totalRevenue.toLocaleString()}</p>
        </div>

        <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
          <p className="text-sm text-medium-grey dark:text-light-grey mb-2">Tokens Distributed ($SEND)</p>
          <p className="text-2xl font-bold text-primary">{loading ? "..." : stats.totalTokensDistributed.toLocaleString()} $SEND</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              className="w-full px-4 py-2 rounded-lg border border-light-grey dark:border-medium-grey bg-white dark:bg-background-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2"
              style={{ focusRingColor: COLORS.primary }}
              aria-label="Filter by transaction status"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
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
                  Wallet Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary dark:text-text-primary-dark uppercase tracking-wider">
                  NGN Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary dark:text-text-primary-dark uppercase tracking-wider">
                  $SEND Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary dark:text-text-primary-dark uppercase tracking-wider">
                  Exchange Rate
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
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-light-blue dark:hover:bg-background-dark transition-colors">
                    <td className="px-4 py-4">
                      <p className="text-sm font-mono text-text-primary dark:text-text-primary-dark">
                        {tx.transaction_id.slice(0, 12)}...
                      </p>
                      {tx.paystack_reference && (
                        <p className="text-xs text-medium-grey dark:text-light-grey mt-1">
                          Paystack: {tx.paystack_reference.slice(0, 12)}...
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-mono text-text-primary dark:text-text-primary-dark">
                        {tx.wallet_address.slice(0, 10)}...{tx.wallet_address.slice(-8)}
                      </p>
                      {tx.sendtag && (
                        <p className="text-xs text-medium-grey dark:text-light-grey mt-1">
                          SendTag: {tx.sendtag}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                        ₦{parseFloat(tx.ngn_amount?.toString() || "0").toLocaleString()}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                        {parseFloat(tx.send_amount || "0").toLocaleString()} $SEND
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-medium-grey dark:text-light-grey">
                        {tx.exchange_rate ? `₦${parseFloat(tx.exchange_rate.toString()).toLocaleString()}` : "N/A"}
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
                        {tx.tx_hash && (
                          <a
                            href={`https://basescan.org/tx/${tx.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs hover:underline"
                            style={{ color: COLORS.primary }}
                          >
                            View on Basescan →
                          </a>
                        )}
                        {tx.error_message && (
                          <p className="text-xs text-error" title={tx.error_message}>
                            Error: {tx.error_message.slice(0, 30)}...
                          </p>
                        )}
                        {tx.completed_at && (
                          <p className="text-xs text-medium-grey dark:text-light-grey">
                            Completed: {new Date(tx.completed_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
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
