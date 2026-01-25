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
    async function verifyPayment(attemptNumber = 1) {
      const maxAttempts = 10; // Poll for up to 30 seconds (10 attempts × 3 seconds)
      
      // Early return if txRef is null (shouldn't happen due to check above, but TypeScript needs this)
      if (!txRef) {
        setStatus("error");
        setMessage("No payment reference found");
        return;
      }
      
      try {
        console.log(`[Payment Callback] Verification attempt ${attemptNumber}/${maxAttempts} for tx_ref: ${txRef}`);
        
        // Extract transaction ID from Flutterwave tx_ref if possible
        // Format: FLW-{timestamp}-{random}-{transactionIdPrefix}
        let transactionId = txRef || "";
        if (txRef && txRef.startsWith("FLW-")) {
          const parts = txRef.split("-");
          // The transaction ID might be in the last part or we need to search by metadata
          if (parts.length >= 4) {
            // Try to extract - but this might not work if format changed
            // Better to search by metadata
          }
        }

        // Strategy 1: Try to find transaction by payment_reference (Flutterwave tx_ref)
        // This works after webhook has processed the payment
        let response = await fetch(`/api/transactions/create-id?paymentReference=${encodeURIComponent(txRef)}`);
        let data = await response.json();

        // Strategy 2: If not found by payment_reference, search by metadata.flutterwave_tx_ref
        // This helps find transactions even before webhook processes them
        if (!data.success || !data.exists) {
          console.log(`[Payment Callback] Not found by payment_reference, searching by metadata...`);
          
          // Try to find by checking all pending transactions with matching metadata
          // We'll need to add an API endpoint for this, or improve the existing one
          response = await fetch(`/api/transactions/create-id?transactionId=${encodeURIComponent(transactionId)}`);
          data = await response.json();
        }

        // Strategy 3: If still not found and we have a transactionId, try direct lookup
        if ((!data.success || !data.exists) && transactionId && transactionId !== txRef) {
          console.log(`[Payment Callback] Trying direct transaction lookup: ${transactionId}`);
          response = await fetch(`/api/transactions/create-id?transactionId=${encodeURIComponent(transactionId)}`);
          data = await response.json();
        }

        if (data.success && data.exists) {
          console.log(`[Payment Callback] Transaction found: ${data.transactionId}, status: ${data.status}`);
          
          if (data.status === "completed" && data.txHash) {
            setStatus("success");
            setTxHash(data.txHash);
            setMessage(
              `Payment successful! ${data.sendAmount || ""} $SEND tokens have been sent to your wallet.`
            );
          } else if (data.status === "pending") {
            // Transaction exists but webhook hasn't processed it yet
            if (attemptNumber < maxAttempts) {
              setStatus("loading");
              setMessage(`Payment received! Processing token distribution... (${attemptNumber}/${maxAttempts})`);
              // Poll for completion (webhook might still be processing)
              setTimeout(() => verifyPayment(attemptNumber + 1), 3000);
            } else {
              // Max attempts reached - webhook might be delayed
              setStatus("loading");
              setMessage("Payment received! The webhook is taking longer than expected. Please check your transaction history in a few moments. Your tokens will be distributed automatically.");
            }
          } else if (data.status === "failed") {
            setStatus("error");
            setMessage(data.error_message || "Payment verification failed");
          } else {
            setStatus("loading");
            setMessage(`Payment status: ${data.status}. Processing...`);
            if (attemptNumber < maxAttempts) {
              setTimeout(() => verifyPayment(attemptNumber + 1), 3000);
            }
          }
        } else {
          // Transaction not found yet
          if (attemptNumber < maxAttempts) {
            console.log(`[Payment Callback] Transaction not found yet, retrying... (${attemptNumber}/${maxAttempts})`);
            setStatus("loading");
            setMessage(`Verifying payment... (${attemptNumber}/${maxAttempts})`);
            // The transaction might not be created yet, or webhook hasn't processed it
            setTimeout(() => verifyPayment(attemptNumber + 1), 3000);
          } else {
            // Max attempts reached
            setStatus("error");
            setMessage("Transaction not found. The webhook may still be processing. Please check your transaction history in a few moments. If payment was successful, tokens will be distributed automatically.");
          }
        }
      } catch (error) {
        console.error("Payment verification error:", error);
        if (attemptNumber < maxAttempts) {
          // Retry on error
          setTimeout(() => verifyPayment(attemptNumber + 1), 3000);
        } else {
          setStatus("error");
          setMessage("Failed to verify payment. Please check your transaction history or contact support.");
        }
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
              {message || "Please wait while we verify your payment."}
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

