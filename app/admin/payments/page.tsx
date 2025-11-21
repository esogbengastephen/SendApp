"use client";

import { useState } from "react";

interface Payment {
  reference: string;
  amount: number;
  status: string;
  customer: string;
  createdAt: string;
  verified: boolean;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  const handleVerifyPayment = async (reference: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/paystack/verify?reference=${reference}`);
      const data = await response.json();
      
      if (data.success) {
        // Update payment status
        setPayments((prev) =>
          prev.map((p) =>
            p.reference === reference ? { ...p, verified: true, status: "success" } : p
          )
        );
        alert("Payment verified successfully!");
      } else {
        alert("Payment verification failed");
      }
    } catch (error) {
      console.error("Verification error:", error);
      alert("Error verifying payment");
    } finally {
      setLoading(false);
    }
  };

  // Mock data
  const mockPayments: Payment[] = [
    {
      reference: "ref_abc123",
      amount: 100000,
      status: "success",
      customer: "customer@example.com",
      createdAt: new Date().toISOString(),
      verified: true,
    },
    {
      reference: "ref_abc124",
      amount: 50000,
      status: "pending",
      customer: "customer2@example.com",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      verified: false,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Payment Verification
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Verify and manage Paystack payments
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
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
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {mockPayments.map((payment) => (
                <tr key={payment.reference} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                  <td className="px-6 py-4">
                    <div className="text-sm font-mono text-slate-900 dark:text-slate-100">
                      {payment.reference}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      ₦{(payment.amount / 100).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        payment.status === "success"
                          ? "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400"
                          : "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400"
                      }`}
                    >
                      {payment.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                    {new Date(payment.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    {!payment.verified && (
                      <button
                        onClick={() => handleVerifyPayment(payment.reference)}
                        disabled={loading}
                        className="bg-primary text-slate-900 font-medium px-3 py-1 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        Verify
                      </button>
                    )}
                    {payment.verified && (
                      <span className="text-green-600 dark:text-green-400 text-sm">
                        Verified
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

