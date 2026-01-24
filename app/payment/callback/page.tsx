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
  // Flutterwave uses tx_ref, but we also check reference for compatibility
  const txRef = searchParams.get("tx_ref") || searchParams.get("reference");
  const statusParam = searchParams.get("status");

  useEffect(() => {
    if (!txRef) {
      setStatus("error");
      setMessage("No payment reference found");
      return;
    }

    // Check status from URL params first (Flutterwave redirects with status)
    if (statusParam === "successful" || statusParam === "success") {
      // Payment was successful, verify and check transaction status
      verifyPayment();
    } else if (statusParam === "cancelled" || statusParam === "failed") {
      setStatus("error");
      setMessage("Payment was cancelled or failed. Please try again.");
    } else {
      // No status param, verify payment
      verifyPayment();
    }

    // Verify the payment
    async function verifyPayment() {
      try {
        // Extract transaction ID from Flutterwave tx_ref
        // Format: FLW-{transactionId}-{timestamp}-{random}
        let transactionId = txRef;
        if (txRef.startsWith("FLW-")) {
          // Extract our transaction ID from Flutterwave reference
          const parts = txRef.split("-");
          if (parts.length >= 2) {
            transactionId = parts.slice(1, -2).join("-"); // Get transaction ID (skip FLW prefix and last 2 parts which are timestamp-random)
            // Actually, let's try a simpler approach - find by payment_reference
            // The webhook stores the Flutterwave tx_ref in payment_reference
          }
        }

        // Try to find transaction by payment_reference first (Flutterwave tx_ref)
        // If not found, try by transaction_id
        let response = await fetch(`/api/transactions/create-id?paymentReference=${txRef}`);
        let data = await response.json();

        // If not found by payment_reference, try by transaction_id
        if (!data.success || !data.exists) {
          response = await fetch(`/api/transactions/create-id?transactionId=${transactionId}`);
          data = await response.json();
        }

        if (data.success && data.exists) {
          if (data.status === "completed" && data.txHash) {
            setStatus("success");
            setTxHash(data.txHash);
            setMessage(
              `Payment successful! ${data.sendAmount || ""} $SEND tokens have been sent to your wallet.`
            );
          } else if (data.status === "pending") {
            setStatus("loading");
            setMessage("Payment received! Processing token distribution...");
            // Poll for completion (webhook might still be processing)
            setTimeout(() => verifyPayment(), 3000);
          } else {
            setStatus("error");
            setMessage(data.error_message || "Payment verification failed");
          }
        } else {
          setStatus("error");
          setMessage("Transaction not found. The webhook may still be processing. Please check your transaction history in a few moments.");
        }
      } catch (error) {
        console.error("Payment verification error:", error);
        setStatus("error");
        setMessage("Failed to verify payment. Please check your transaction history or contact support.");
      }
    }
  }, [txRef, statusParam]);

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

