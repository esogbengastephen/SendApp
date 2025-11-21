"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Transaction {
  transactionId: string;
  paystackReference: string;
  ngnAmount: number;
  sendAmount: string;
  walletAddress: string;
  status: "pending" | "completed" | "failed";
  createdAt: Date;
  completedAt?: Date;
  txHash?: string;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "failed">("all");

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

  const filteredTransactions =
    filter === "all"
      ? transactions
      : transactions.filter((tx) => tx.status === filter);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Transactions
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            View and manage all transactions
          </p>
        </div>
        <button className="bg-primary text-slate-900 font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
          Export CSV
        </button>
      </div>

      {/* Filters */}
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

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Transaction ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Wallet Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
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
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {tx.sendAmount} SEND
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-mono text-slate-900 dark:text-slate-100 max-w-xs truncate">
                        {tx.walletAddress}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(tx.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                      {new Date(tx.createdAt).toLocaleString()}
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
  );
}

