"use client";

import { useState, useEffect } from "react";

interface Payment {
  reference: string;
  amount: number;
  status: string;
  customer: string;
  createdAt: string;
  verified: boolean;
  transactionId?: string | null;
  walletAddress?: string | null;
  sendAmount?: string | null;
  txHash?: string | null;
  source?: string;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const response = await fetch("/api/admin/payments");
      const contentType = response.headers.get("content-type") || "";
      let data: { success?: boolean; payments?: Payment[]; error?: string; details?: string } = {};
      if (contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch {
          data = { error: `Invalid JSON (status ${response.status})` };
        }
      } else {
        data = { error: response.ok ? "Server returned non-JSON" : `Request failed (${response.status})` };
      }

      if (data.success === true && Array.isArray(data.payments)) {
        setPayments(data.payments);
      } else {
        const msg =
          data.error ||
          data.details ||
          (response.ok ? "Server returned no payments data." : `Request failed (${response.status}).`);
        setFetchError(msg);
        if (process.env.NODE_ENV === "development") {
          const extra = data.error || data.details ? null : (Object.keys(data).length ? data : "empty response");
          console.warn("Payments fetch failed:", response.status, msg, extra ?? "");
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Could not load payments";
      setFetchError(msg);
      if (process.env.NODE_ENV === "development") {
        console.error("Payments fetch error:", msg, error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPayment = async (reference: string, source?: string) => {
    if (source === "Flutterwave") {
      alert("Flutterwave payments are verified via webhook. Status is already up to date.");
      return;
    }
    setVerifying(reference);
    try {
      const response = await fetch(`/api/paystack/verify?reference=${reference}`);
      const data = await response.json();
      
      if (data.success) {
        await fetchPayments();
        alert("Payment verified successfully!");
      } else {
        alert("Payment verification failed");
      }
    } catch (error) {
      console.error("Verification error:", error);
      alert("Error verifying payment");
    } finally {
      setVerifying(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Payment Verification
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 sm:mt-2">
          Verify and manage payments (Paystack & Flutterwave)
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Reference
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Loading payments...
                  </td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center">
                    <p className="text-slate-600 dark:text-slate-400 mb-2">{fetchError}</p>
                    <button
                      type="button"
                      onClick={fetchPayments}
                      className="bg-primary text-slate-900 font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity text-sm"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No payments found
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.reference} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-6 py-4">
                      <div className="text-sm font-mono text-slate-900 dark:text-slate-100">
                        {payment.reference}
                      </div>
                      {payment.transactionId && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          TX: {payment.transactionId.substring(0, 8)}...
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        ₦{payment.amount.toLocaleString()}
                      </div>
                      {payment.sendAmount && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {payment.sendAmount} $SEND
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          payment.status === "success"
                            ? "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400"
                            : payment.status === "pending"
                            ? "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400"
                            : "bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400"
                        }`}
                      >
                        {payment.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {payment.source || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {new Date(payment.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        {!payment.verified && payment.status === "success" && payment.source === "Paystack" && (
                          <button
                            onClick={() => handleVerifyPayment(payment.reference, payment.source)}
                            disabled={verifying === payment.reference}
                            className="bg-primary text-slate-900 font-medium px-3 py-1 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-xs"
                          >
                            {verifying === payment.reference ? "Verifying..." : "Verify"}
                          </button>
                        )}
                        {payment.verified && (
                          <span className="text-green-600 dark:text-green-400 text-sm">
                            ✓ Verified
                          </span>
                        )}
                        {payment.txHash && (
                          <a
                            href={`https://basescan.org/tx/${payment.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:opacity-70 transition-opacity text-xs"
                          >
                            View TX
                          </a>
                        )}
                        {payment.walletAddress && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate max-w-[120px]">
                            {payment.walletAddress.substring(0, 6)}...{payment.walletAddress.slice(-4)}
                          </div>
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

