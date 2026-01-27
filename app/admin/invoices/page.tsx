"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface AdminInvoice {
  id: string;
  invoiceNumber: string;
  userId: string | null;
  merchantEmail: string;
  amount: number;
  currency: string;
  cryptoChainId: string | null;
  description: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  transactionId: string | null;
  paystackReference: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const url = statusFilter
        ? `/api/admin/invoices?status=${encodeURIComponent(statusFilter)}`
        : "/api/admin/invoices";
      const response = await fetch(url);
      const contentType = response.headers.get("content-type") || "";
      let data: { success?: boolean; invoices?: AdminInvoice[]; error?: string; details?: string } = {};
      if (contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch {
          data = { error: `Invalid JSON (status ${response.status})` };
        }
      } else {
        data = { error: response.ok ? "Server returned non-JSON" : `Request failed (${response.status})` };
      }

      if (data.success === true && Array.isArray(data.invoices)) {
        setInvoices(data.invoices);
      } else {
        const msg =
          data.error ||
          data.details ||
          (response.ok ? "Server returned no invoice data." : `Request failed (${response.status}).`);
        setFetchError(msg);
      }
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : "Could not load invoices");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const formatAmount = (inv: AdminInvoice) => {
    const n = inv.amount;
    if (inv.currency === "NGN") {
      return `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${inv.currency}`;
  };

  const customerLabel = (inv: AdminInvoice) =>
    inv.customerName || inv.customerEmail || inv.customerPhone || "—";

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Invoices
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 sm:mt-2">
            View and manage all generated invoices. Merchants create invoices at{" "}
            <Link href="/invoice" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
              /invoice
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <label htmlFor="status-filter" className="text-sm text-slate-600 dark:text-slate-400 shrink-0">
              Status:
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <Link
            href="/invoice"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-primary text-slate-900 font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity text-sm whitespace-nowrap"
          >
            Generate invoice
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Invoice #
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Merchant
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Customer
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Description
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Amount
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Status
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Due / Created
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 sm:px-6 py-8 text-center text-slate-500">
                      Loading invoices...
                    </td>
                  </tr>
                ) : fetchError ? (
                  <tr>
                    <td colSpan={8} className="px-4 sm:px-6 py-8 text-center">
                      <p className="text-slate-600 dark:text-slate-400 mb-2">{fetchError}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mb-3 max-w-md mx-auto">
                        Ensure the invoices migration has been applied in Supabase and SUPABASE_SERVICE_ROLE_KEY is set for the admin API.
                      </p>
                      <button
                        type="button"
                        onClick={fetchInvoices}
                        className="bg-primary text-slate-900 font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity text-sm"
                      >
                        Retry
                      </button>
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 sm:px-6 py-8 text-center text-slate-500">
                      No invoices found. Invoices created by users at /invoice will appear here.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-4 sm:px-6 py-4">
                        <span className="text-sm font-mono text-slate-900 dark:text-slate-100">
                          {inv.invoiceNumber}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                        {inv.merchantEmail}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-slate-600 dark:text-slate-400 max-w-[140px] truncate" title={customerLabel(inv)}>
                        {customerLabel(inv)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-slate-600 dark:text-slate-400 max-w-[140px] truncate" title={inv.description || "—"}>
                        {inv.description || "—"}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatAmount(inv)}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            inv.status === "paid"
                              ? "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400"
                              : inv.status === "pending"
                              ? "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400"
                              : inv.status === "expired" || inv.status === "cancelled"
                              ? "bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400"
                              : "bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400"
                          }`}
                        >
                          {inv.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                        <span className="block" title={inv.dueDate ? `Due: ${new Date(inv.dueDate).toLocaleString()}` : undefined}>
                          {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                        </span>
                        <span className="block text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          {new Date(inv.createdAt).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <a
                          href={`/invoice/${inv.invoiceNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-sm font-medium"
                        >
                          View
                        </a>
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
