"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, subDays } from "date-fns";
import { getSendAmountForTransaction } from "@/lib/transactions";

interface Transaction {
  transactionId: string;
  idempotencyKey?: string;
  paystackReference: string;
  ngnAmount: number;
  sendAmount: string;
  walletAddress: string;
  status: "pending" | "completed" | "failed";
  createdAt: Date;
  initializedAt?: Date;
  completedAt?: Date;
  lastCheckedAt?: Date;
  verificationAttempts?: number;
  verificationHistory?: Array<{
    attemptNumber: number;
    point1Verified: boolean;
    point2Verified: boolean;
    point3Verified: boolean;
    allPointsVerified: boolean;
    paystackReference?: string;
    errorMessage?: string;
    createdAt: Date;
  }>;
  txHash?: string;
  sendtag?: string;
  exchangeRate?: number;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "failed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });
  const [amountRange, setAmountRange] = useState({
    min: "",
    max: "",
  });

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const url = filter === "all" ? "/api/admin/transactions" : `/api/admin/transactions?status=${filter}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.success) {
          setTransactions(
            data.transactions.map((tx: any) => ({
              ...tx,
              createdAt: new Date(tx.createdAt),
              completedAt: tx.completedAt ? new Date(tx.completedAt) : undefined,
            }))
          );
        }
      } catch (error) {
        console.error("Error fetching transactions:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [filter]);

  // Apply filters
  useEffect(() => {
    let filtered = [...transactions];

    // Date range filter
    if (dateRange.start && dateRange.end) {
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);

      filtered = filtered.filter((tx) => {
        const txDate = new Date(tx.createdAt);
        return txDate >= startDate && txDate <= endDate;
      });
    }

    // Amount range filter
    if (amountRange.min) {
      filtered = filtered.filter((tx) => tx.ngnAmount >= parseFloat(amountRange.min));
    }
    if (amountRange.max) {
      filtered = filtered.filter((tx) => tx.ngnAmount <= parseFloat(amountRange.max));
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.transactionId.toLowerCase().includes(query) ||
          tx.paystackReference.toLowerCase().includes(query) ||
          tx.walletAddress.toLowerCase().includes(query)
      );
    }

    setFilteredTransactions(filtered);
  }, [transactions, dateRange, amountRange, searchQuery]);


  const getStatusBadge = (status: string) => {
    const styles = {
      pending: "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400",
      completed: "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400",
      failed: "bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400",
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}
      >
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Transactions
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 sm:mt-2">
            View and manage all transactions
          </p>
        </div>
        <button className="bg-primary text-slate-900 font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity text-sm sm:text-base w-full sm:w-auto">
          Export CSV
        </button>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">Filters</h2>
        
        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Status
          </label>
          <div className="flex gap-2">
            {(["all", "pending", "completed", "failed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === f
                    ? "bg-primary text-slate-900"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Search
          </label>
          <input
            type="text"
            placeholder="Search by Transaction ID, Reference, or Wallet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        {/* Amount Range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Min Amount (NGN)
            </label>
            <input
              type="number"
              placeholder="0"
              value={amountRange.min}
              onChange={(e) => setAmountRange({ ...amountRange, min: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Max Amount (NGN)
            </label>
            <input
              type="number"
              placeholder="No limit"
              value={amountRange.max}
              onChange={(e) => setAmountRange({ ...amountRange, max: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        {/* Clear Filters */}
        <button
          onClick={() => {
            setSearchQuery("");
            setDateRange({
              start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
              end: format(new Date(), "yyyy-MM-dd"),
            });
            setAmountRange({ min: "", max: "" });
          }}
          className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          Clear Filters
        </button>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Showing {filteredTransactions.length} of {transactions.length} transactions
        </p>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle px-4 sm:px-0">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Transaction ID
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                  Wallet Address
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">
                  Verification
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                  Date
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 sm:px-6 py-8 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 sm:px-6 py-8 text-center text-slate-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr
                    key={tx.transactionId}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {tx.transactionId}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {tx.paystackReference}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        ₦{tx.ngnAmount.toLocaleString()}
                      </div>
                      <div className={`text-xs font-medium ${
                        parseFloat(getSendAmountForTransaction(tx)) > 0 
                          ? "text-green-600 dark:text-green-400" 
                          : "text-slate-500 dark:text-slate-400"
                      }`}>
                        {getSendAmountForTransaction(tx)} $SEND
                        {tx.txHash && (
                          <span className="ml-1 text-green-600 dark:text-green-400" title="Tokens distributed">
                            ✓
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {tx.walletAddress ? (
                        <div className="text-sm font-mono text-slate-900 dark:text-slate-100 max-w-xs truncate" title={tx.walletAddress}>
                          {tx.walletAddress}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 dark:text-slate-500 italic">
                          Not recorded
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(tx.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {tx.verificationAttempts !== undefined && tx.verificationAttempts > 0 ? (
                        <div className="flex flex-col gap-1">
                          <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {tx.verificationAttempts} attempt{tx.verificationAttempts !== 1 ? "s" : ""}
                          </div>
                          {tx.verificationHistory && tx.verificationHistory.length > 0 && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {tx.verificationHistory[tx.verificationHistory.length - 1].allPointsVerified ? (
                                <span className="text-green-600 dark:text-green-400">✓ Verified</span>
                              ) : (
                                <span className="text-yellow-600 dark:text-yellow-400">⚠ Failed</span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">Not verified</span>
                      )}
                      {tx.idempotencyKey && tx.idempotencyKey === tx.transactionId && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Idempotent
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                      <div>{new Date(tx.createdAt).toLocaleString()}</div>
                      {tx.initializedAt && (
                        <div className="text-xs text-slate-400 dark:text-slate-500">
                          Init: {new Date(tx.initializedAt).toLocaleString()}
                        </div>
                      )}
                      {tx.completedAt && (
                        <div className="text-xs text-green-600 dark:text-green-400">
                          Done: {new Date(tx.completedAt).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button className="text-primary hover:opacity-70 transition-opacity">
                          <span className="material-icons-outlined text-sm">
                            visibility
                          </span>
                        </button>
                        {tx.txHash && (
                          <a
                            href={`https://basescan.org/tx/${tx.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:opacity-70 transition-opacity"
                          >
                            <span className="material-icons-outlined text-sm">
                              open_in_new
                            </span>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}

