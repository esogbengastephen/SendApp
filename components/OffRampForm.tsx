"use client";

import { useState, useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import Modal from "./Modal";
import Toast from "./Toast";
import PoweredBySEND from "./PoweredBySEND";
import { getUserFromStorage } from "@/lib/session";

interface OffRampTransaction {
  transactionId: string;
  uniqueWalletAddress: string;
  accountNumber: string;
  status: string;
}

export default function OffRampForm() {
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [accountName, setAccountName] = useState<string>("");
  const [bankCode, setBankCode] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>("");
  const [uniqueWalletAddress, setUniqueWalletAddress] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    accountNumber?: string;
  }>({});
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState<{
    title: string;
    message: string;
    type: "success" | "error" | "info";
    walletAddress?: string;
    explorerUrl?: string;
  } | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({ message: "", type: "info", isVisible: false });
  const [paymentGenerated, setPaymentGenerated] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<string>("");
  const checkingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check for existing off-ramp transaction in localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedTx = localStorage.getItem("offrampTransaction");
      if (storedTx) {
        try {
          const tx: OffRampTransaction = JSON.parse(storedTx);
          setTransactionId(tx.transactionId);
          setUniqueWalletAddress(tx.uniqueWalletAddress);
          setAccountNumber(tx.accountNumber);
          setPaymentGenerated(true);
          setTransactionStatus(tx.status || "pending");
          // Start checking status
          startStatusCheck(tx.transactionId);
        } catch (error) {
          console.error("Error parsing stored transaction:", error);
        }
      }
    }
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (checkingIntervalRef.current) {
        clearInterval(checkingIntervalRef.current);
      }
    };
  }, []);

  const validateAccountNumber = (account: string): boolean => {
    // Nigerian account numbers are typically 10 digits
    const accountRegex = /^\d{10}$/;
    return accountRegex.test(account);
  };

  const handleGeneratePayment = async () => {
    // Validate account number
    if (!accountNumber.trim()) {
      setErrors({ accountNumber: "Account number is required" });
      return;
    }

    if (!validateAccountNumber(accountNumber)) {
      setErrors({ accountNumber: "Please enter a valid 10-digit account number" });
      return;
    }

    setIsLoading(true);
    setErrors({});

    // Get user email from session
    const user = getUserFromStorage();
    const userEmail = user?.email || null;

    try {
      const response = await fetch("/api/offramp/generate-address", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim() || undefined,
          bankCode: bankCode.trim() || undefined,
          userEmail: userEmail,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTransactionId(data.transactionId);
        setUniqueWalletAddress(data.uniqueWalletAddress);
        setPaymentGenerated(true);
        setTransactionStatus("pending");

        // Store in localStorage
        const tx: OffRampTransaction = {
          transactionId: data.transactionId,
          uniqueWalletAddress: data.uniqueWalletAddress,
          accountNumber: accountNumber.trim(),
          status: "pending",
        };
        localStorage.setItem("offrampTransaction", JSON.stringify(tx));

        // Start checking transaction status
        startStatusCheck(data.transactionId);

        setToast({
          message: "Payment address generated successfully!",
          type: "success",
          isVisible: true,
        });
      } else {
        setToast({
          message: data.message || "Failed to generate payment address",
          type: "error",
          isVisible: true,
        });
      }
    } catch (error) {
      console.error("Error generating payment address:", error);
      setToast({
        message: "An error occurred. Please try again.",
        type: "error",
        isVisible: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startStatusCheck = (txId: string) => {
    // Clear any existing interval
    if (checkingIntervalRef.current) {
      clearInterval(checkingIntervalRef.current);
    }

    setIsCheckingStatus(true);

    // Check status every 10 seconds
    checkingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/offramp/check-status?transactionId=${txId}`);
        const data = await response.json();

        if (data.success && data.status) {
          setTransactionStatus(data.status);

          // Update localStorage
          const storedTx = localStorage.getItem("offrampTransaction");
          if (storedTx) {
            const tx: OffRampTransaction = JSON.parse(storedTx);
            tx.status = data.status;
            localStorage.setItem("offrampTransaction", JSON.stringify(tx));
          }

          // If completed or failed, stop checking
          if (data.status === "completed" || data.status === "failed" || data.status === "refunded") {
            if (checkingIntervalRef.current) {
              clearInterval(checkingIntervalRef.current);
            }
            setIsCheckingStatus(false);

            if (data.status === "completed") {
              setModalData({
                title: "Payment Completed! 🎉",
                message: `Your payment of ${data.ngnAmount} NGN has been sent to account ${accountNumber}.`,
                type: "success",
              });
              setShowModal(true);
            } else if (data.status === "failed") {
              setToast({
                message: data.errorMessage || "Transaction failed. Please contact support.",
                type: "error",
                isVisible: true,
              });
            }
          }
        }
      } catch (error) {
        console.error("Error checking transaction status:", error);
      }
    }, 10000); // Check every 10 seconds
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setToast({
      message: "Copied to clipboard!",
      type: "success",
      isVisible: true,
    });
  };

  const handleReset = () => {
    setAccountNumber("");
    setAccountName("");
    setBankCode("");
    setTransactionId("");
    setUniqueWalletAddress("");
    setPaymentGenerated(false);
    setTransactionStatus("");
    setIsCheckingStatus(false);
    setErrors({});
    
    if (checkingIntervalRef.current) {
      clearInterval(checkingIntervalRef.current);
    }
    
    localStorage.removeItem("offrampTransaction");
  };

  const getStatusMessage = (status: string): string => {
    const statusMessages: Record<string, string> = {
      pending: "Waiting for you to send tokens...",
      token_received: "Token detected! Swapping to USDC...",
      swapping: "Swapping token to USDC...",
      usdc_received: "USDC received! Processing payment...",
      paying: "Sending Naira to your account...",
      completed: "Payment completed!",
      failed: "Transaction failed",
      refunded: "Transaction refunded",
    };
    return statusMessages[status] || "Processing...";
  };

  const getStatusColor = (status: string): string => {
    const statusColors: Record<string, string> = {
      pending: "text-yellow-600 dark:text-yellow-400",
      token_received: "text-blue-600 dark:text-blue-400",
      swapping: "text-blue-600 dark:text-blue-400",
      usdc_received: "text-green-600 dark:text-green-400",
      paying: "text-green-600 dark:text-green-400",
      completed: "text-green-600 dark:text-green-400",
      failed: "text-red-600 dark:text-red-400",
      refunded: "text-gray-600 dark:text-gray-400",
    };
    return statusColors[status] || "text-gray-600 dark:text-gray-400";
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 sm:p-8">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-slate-900 dark:text-slate-100">
          Convert Tokens to Naira
        </h1>
        <p className="text-center text-slate-600 dark:text-slate-400 mb-8">
          Send any Base token and receive Naira in your bank account
        </p>

        {!paymentGenerated ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGeneratePayment();
            }}
            className="space-y-6"
          >
            {/* Account Number */}
            <div>
              <label
                htmlFor="accountNumber"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Account Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="accountNumber"
                value={accountNumber}
                onChange={(e) => {
                  setAccountNumber(e.target.value);
                  setErrors({});
                }}
                placeholder="Enter your 10-digit account number"
                className={`w-full px-4 py-3 rounded-lg border ${
                  errors.accountNumber
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                    : "border-slate-300 dark:border-slate-600 focus:border-primary focus:ring-primary"
                } bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2`}
                maxLength={10}
              />
              {errors.accountNumber && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.accountNumber}</p>
              )}
            </div>

            {/* Account Name (Optional) */}
            <div>
              <label
                htmlFor="accountName"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Account Name (Optional)
              </label>
              <input
                type="text"
                id="accountName"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Enter account name"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 focus:border-primary focus:ring-primary bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2"
              />
            </div>

            {/* Bank Code (Optional) */}
            <div>
              <label
                htmlFor="bankCode"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Bank Code (Optional)
              </label>
              <input
                type="text"
                id="bankCode"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                placeholder="Enter bank code (e.g., 035)"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 focus:border-primary focus:ring-primary bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2"
                maxLength={10}
              />
            </div>

            {/* Generate Payment Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Generating..." : "Generate Payment Address"}
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            {/* Status Display */}
            {transactionStatus && (
              <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-4">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Status</p>
                <p className={`font-semibold ${getStatusColor(transactionStatus)}`}>
                  {getStatusMessage(transactionStatus)}
                </p>
              </div>
            )}

            {/* Wallet Address Display */}
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-xl p-6 border-2 border-primary/20">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                🏦 Send Tokens to This Address
              </h3>
              <div className="bg-white dark:bg-slate-800 rounded-lg p-4 mb-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Wallet Address</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm text-slate-900 dark:text-slate-100 break-all flex-1">
                    {uniqueWalletAddress}
                  </p>
                  <button
                    onClick={() => copyToClipboard(uniqueWalletAddress)}
                    className="px-3 py-1.5 bg-primary text-white text-xs rounded-lg hover:bg-primary-dark transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                💡 Send any Base token (ETH, USDC, DAI, etc.) to this address. It will be automatically converted to USDC and you'll receive Naira in account <strong>{accountNumber}</strong>.
              </p>
            </div>

            {/* Account Info */}
            <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-4">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Receiving Account</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {accountName || "N/A"} - {accountNumber}
              </p>
            </div>

            {/* Reset Button */}
            <button
              onClick={handleReset}
              className="w-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Start New Transaction
            </button>
          </div>
        )}

        <div className="mt-8">
          <PoweredBySEND />
        </div>
      </div>

      {/* Modal */}
      {showModal && modalData && (
        <Modal
          title={modalData.title}
          message={modalData.message}
          type={modalData.type}
          onClose={() => {
            setShowModal(false);
            handleReset();
          }}
        />
      )}

      {/* Toast */}
      {toast.isVisible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, isVisible: false })}
        />
      )}
    </div>
  );
}

