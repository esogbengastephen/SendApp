"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Modal from "@/components/Modal";
import Link from "next/link";

function PaymentCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const reference = searchParams.get("reference");

  useEffect(() => {
    if (!reference) {
      setStatus("error");
      setMessage("No payment reference found");
      return;
    }

    // Verify the payment
    const verifyPayment = async () => {
      try {
        const response = await fetch(`/api/paystack/verify?reference=${reference}`);
        const data = await response.json();

        if (data.success && data.data?.status === "success") {
          setStatus("success");
          setMessage(
            `Payment successful! Your $SEND tokens are being distributed to your wallet.`
          );
          // Note: Token distribution happens via webhook, so we don't have txHash here
        } else {
          setStatus("error");
          setMessage(data.message || "Payment verification failed");
        }
      } catch (error) {
        console.error("Payment verification error:", error);
        setStatus("error");
        setMessage("Failed to verify payment. Please check your transaction in Paystack dashboard.");
      }
    };

    verifyPayment();
  }, [reference]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark p-4">
      <div className="w-full max-w-md">
        {status === "loading" && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-lg text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Verifying Payment...
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Please wait while we verify your payment.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-lg text-center">
            <div className="bg-green-100 dark:bg-green-900/20 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <span className="material-icons-outlined text-green-600 dark:text-green-400 text-4xl">
                check_circle
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Payment Successful!
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">{message}</p>
            {txHash && (
              <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg mb-4">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Transaction Hash:
                </p>
                <p className="text-xs font-mono text-slate-900 dark:text-slate-100 break-all">
                  {txHash}
                </p>
              </div>
            )}
            <Link
              href="/"
              className="inline-block bg-primary text-slate-900 font-bold py-2 px-6 rounded-md hover:opacity-90 transition-opacity"
            >
              Make Another Payment
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-lg text-center">
            <div className="bg-red-100 dark:bg-red-900/20 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <span className="material-icons-outlined text-red-600 dark:text-red-400 text-4xl">
                error
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Payment Failed
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">{message}</p>
            <Link
              href="/"
              className="inline-block bg-primary text-slate-900 font-bold py-2 px-6 rounded-md hover:opacity-90 transition-opacity"
            >
              Try Again
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentCallback() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark p-4">
          <div className="w-full max-w-md">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-lg text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Loading...
              </h2>
            </div>
          </div>
        </div>
      }
    >
      <PaymentCallbackContent />
    </Suspense>
  );
}

