"use client";

import { useState, useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import { isValidWalletOrTag, isValidAmount } from "@/utils/validation";
import Modal from "./Modal";
import Toast from "./Toast";
import PoweredBySEND from "./PoweredBySEND";
import { calculateSendAmount } from "@/lib/transactions";
import { getUserFromStorage } from "@/lib/session";

// Helper function to safely access localStorage (for mobile browser compatibility)
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`Error getting localStorage item ${key}:`, e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window === "undefined" || typeof localStorage === "undefined") return;
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`Error setting localStorage item ${key}:`, e);
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window === "undefined" || typeof localStorage === "undefined") return;
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`Error removing localStorage item ${key}:`, e);
    }
  },
};

interface VirtualAccount {
  accountNumber: string;
  bankName: string;
  hasVirtualAccount: boolean;
}

export default function PaymentForm() {
  const [ngnAmount, setNgnAmount] = useState<string>("");
  const [sendAmount, setSendAmount] = useState<string>("0.00");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTransactionCompleted, setIsTransactionCompleted] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(50);
  const [minimumPurchase, setMinimumPurchase] = useState<number>(3000);
  const [errors, setErrors] = useState<{
    ngnAmount?: string;
    walletAddress?: string;
  }>({});
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState<{
    title: string;
    message: string;
    type: "success" | "error" | "info";
    txHash?: string;
    explorerUrl?: string;
  } | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({ message: "", type: "info", isVisible: false });
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccount | null>(null);
  const [isLoadingVirtualAccount, setIsLoadingVirtualAccount] = useState(false);
  const [paymentGenerated, setPaymentGenerated] = useState(false);
  const [isPollingPayment, setIsPollingPayment] = useState(false);
  const [transactionsEnabled, setTransactionsEnabled] = useState(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Note: Virtual account is now only fetched/created when "Generate Payment" is clicked
  // This ensures account details are only shown after user initiates payment

  // Auto-claim pending transactions on mount
  useEffect(() => {
    const checkForPendingTransactions = async () => {
      // Get stored transaction ID from localStorage
      const storedTxId = safeLocalStorage.getItem("transactionId");
      if (!storedTxId) return;
      
      // Get stored wallet address and amount if available
      const storedWallet = safeLocalStorage.getItem("walletAddress");
      const storedAmount = safeLocalStorage.getItem("ngnAmount");
      
      if (!storedWallet || !storedAmount) return;
      
      // Only check if form is not being used
      if (ngnAmount || walletAddress) return;
      
      try {
        // Check if this transaction is completed (webhook should have processed it)
        const response = await fetch(`/api/transactions/create-id?transactionId=${storedTxId}`);
        const data = await response.json();
        if (data.success && data.exists && data.status === "completed" && data.txHash) {
          // Transaction was completed by webhook!
          setModalData({
            title: "Tokens Received! 🎉",
            message: "Your payment was processed and tokens have been sent to your wallet.",
            type: "success",
            txHash: data.txHash,
            explorerUrl: data.txHash ? `https://basescan.org/tx/${data.txHash}` : undefined,
          });
          setShowModal(true);
          
          // Clear stored transaction ID
          safeLocalStorage.removeItem("transactionId");
          safeLocalStorage.removeItem("walletAddress");
          safeLocalStorage.removeItem("ngnAmount");
          
          // Refresh page after 3 seconds
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      } catch (error) {
        console.error("Error checking for pending transactions:", error);
        // Silent fail - don't show error to user
      }
    };
    
    // Only check if we have a stored transaction ID and form is not being used
    const storedId = safeLocalStorage.getItem("transactionId");
    if (storedId && !ngnAmount && !walletAddress) {
      checkForPendingTransactions();
    }
  }, []); // Run once on mount

  // Check for existing transaction ID in localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedId = safeLocalStorage.getItem("transactionId");
      if (storedId) {
        // Check if transaction ID exists in database
        fetch(`/api/transactions/create-id?transactionId=${storedId}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.exists) {
              setTransactionId(storedId);
              console.log("[PaymentForm] Restored transaction ID from localStorage:", storedId);
            } else {
              // Transaction ID doesn't exist in database, generate new one
              generateNewTransactionId();
            }
          })
          .catch(() => {
            // On error, generate new ID
            generateNewTransactionId();
          });
      } else {
        // No stored ID, will generate when user inputs amount
      }
    }
  }, []);

  // Generate new transaction ID and store in database
  const generateNewTransactionId = async () => {
    try {
      const response = await fetch("/api/transactions/create-id", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (data.success && data.transactionId) {
        const id = data.transactionId;
        setTransactionId(id);
        if (typeof window !== "undefined") {
          safeLocalStorage.setItem("transactionId", id);
        }
        console.log("[PaymentForm] Generated new transaction ID:", id);
      }
    } catch (error) {
      console.error("Failed to generate transaction ID:", error);
      // Fallback: generate locally
      const id = nanoid();
      setTransactionId(id);
      if (typeof window !== "undefined") {
        localStorage.setItem("transactionId", id);
      }
    }
  };

  // Fetch transaction status on mount
  useEffect(() => {
    const fetchTransactionStatus = async () => {
      try {
        const response = await fetch(`/api/rate?t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
          },
        });
        const data = await response.json();
        if (data.success) {
          setTransactionsEnabled(data.transactionsEnabled !== false);
        }
      } catch (error) {
        console.error("Failed to fetch transaction status:", error);
        // Default to enabled on error
      }
    };
    
    fetchTransactionStatus();
    // Refresh every 30 seconds
    const statusInterval = setInterval(fetchTransactionStatus, 30000);
    
    return () => clearInterval(statusInterval);
  }, []);

  // Fetch exchange rate on mount and periodically to get admin updates
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        // Add cache-busting to ensure we get the latest rate
        const response = await fetch(`/api/rate?t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
          },
        });
        const data = await response.json();
        console.log("[PaymentForm] Fetched exchange rate:", data);
        if (data.success && data.rate) {
          const newRate = parseFloat(data.rate);
          console.log(`[PaymentForm] Updating exchange rate to: ${newRate} (from admin settings)`);
          setExchangeRate(newRate);
          // Also update transaction status if provided
          if (data.transactionsEnabled !== undefined) {
            setTransactionsEnabled(data.transactionsEnabled !== false);
          }
          // Update minimum purchase if provided
          if (data.minimumPurchase !== undefined) {
            setMinimumPurchase(data.minimumPurchase || 3000);
          }
        }
      } catch (error) {
        console.error("Failed to fetch exchange rate:", error);
        // Use default rate on error
      }
    };

    // Fetch immediately on mount
    fetchExchangeRate();

    // Refresh every 10 seconds to get admin updates immediately
    const interval = setInterval(fetchExchangeRate, 10000);

    // Refresh when window regains focus (user comes back to tab)
    const handleFocus = () => {
      console.log("[PaymentForm] Window focused, refreshing exchange rate");
      fetchExchangeRate();
    };
    window.addEventListener("focus", handleFocus);

    // Refresh when page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      try {
        if (typeof document !== "undefined" && !document.hidden) {
          console.log("[PaymentForm] Page visible, refreshing exchange rate");
          fetchExchangeRate();
        }
      } catch (e) {
        console.warn("Error in visibility change handler:", e);
      }
    };
    
    try {
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", handleVisibilityChange);
      }
    } catch (e) {
      console.warn("Error adding visibility change listener:", e);
    }

    // Listen for exchange rate updates from admin dashboard (cross-tab communication)
    const handleRateUpdate = (event: CustomEvent) => {
      try {
        console.log("[PaymentForm] Exchange rate updated event received:", event.detail);
        fetchExchangeRate();
      } catch (e) {
        console.warn("Error in rate update handler:", e);
      }
    };
    
    try {
      if (typeof window !== "undefined") {
        window.addEventListener("exchangeRateUpdated" as any, handleRateUpdate as EventListener);
      }
    } catch (e) {
      console.warn("Error adding rate update listener:", e);
    }

    return () => {
      try {
        clearInterval(interval);
        if (typeof window !== "undefined") {
          window.removeEventListener("focus", handleFocus);
          window.removeEventListener("exchangeRateUpdated" as any, handleRateUpdate as EventListener);
        }
        if (typeof document !== "undefined") {
          document.removeEventListener("visibilitychange", handleVisibilityChange);
        }
      } catch (e) {
        console.warn("Error cleaning up event listeners:", e);
      }
    };
  }, []);

  // Calculate $SEND amount based on NGN amount and generate transaction ID when amount is entered
  useEffect(() => {
    if (ngnAmount && parseFloat(ngnAmount) > 0) {
      const calculated = (parseFloat(ngnAmount) * exchangeRate).toFixed(2);
      setSendAmount(calculated);

      // Always ensure transaction ID exists when amount is entered
      // Check both state and localStorage
      const storedId = safeLocalStorage.getItem("transactionId");
      const currentId = transactionId || storedId;
      
      if (!currentId || currentId.trim() === "") {
        console.log(`[PaymentForm] Generating transaction ID for amount: ${ngnAmount}`);
        generateNewTransactionId();
      } else {
        // Ensure state is synced with localStorage
        if (currentId !== transactionId) {
          setTransactionId(currentId);
        }
        // Update existing transaction ID with amount and exchange rate
        updateTransactionIdWithAmount(parseFloat(ngnAmount), calculated);
      }
    } else {
      setSendAmount("0.00");
    }
  }, [ngnAmount, exchangeRate]);

  // Update transaction ID in database with amount and exchange rate
  const updateTransactionIdWithAmount = async (amount: number, sendAmt: string) => {
    if (!transactionId) return;

    try {
      const response = await fetch("/api/transactions/create-id", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactionId,
          ngnAmount: amount,
          sendAmount: sendAmt,
          // Note: exchangeRate is not sent - backend uses admin-set rate from settings
        }),
      });

      const data = await response.json();
      if (data.success) {
        console.log("[PaymentForm] Updated transaction ID with amount:", transactionId);
      }
    } catch (error) {
      console.error("Failed to update transaction ID:", error);
    }
  };

  // Auto-claim pending transactions on mount
  useEffect(() => {
    const checkForPendingTransactions = async () => {
      // Get stored transaction ID from localStorage
      const storedTxId = safeLocalStorage.getItem("transactionId");
      if (!storedTxId) return;
      
      // Get stored wallet address and amount if available
      const storedWallet = safeLocalStorage.getItem("walletAddress");
      const storedAmount = safeLocalStorage.getItem("ngnAmount");
      
      if (!storedWallet || !storedAmount) return;
      
      // Only check if form is not being used
      if (ngnAmount || walletAddress) return;
      
      try {
        // Check if this transaction is completed (webhook should have processed it)
        const response = await fetch(`/api/transactions/create-id?transactionId=${storedTxId}`);
        const data = await response.json();
        if (data.success && data.exists && data.status === "completed" && data.txHash) {
          // Transaction was completed by webhook!
          setModalData({
            title: "Tokens Received! 🎉",
            message: "Your payment was processed and tokens have been sent to your wallet.",
            type: "success",
            txHash: data.txHash,
            explorerUrl: data.txHash ? `https://basescan.org/tx/${data.txHash}` : undefined,
          });
          setShowModal(true);
          
          // Clear stored transaction ID
          safeLocalStorage.removeItem("transactionId");
          safeLocalStorage.removeItem("walletAddress");
          safeLocalStorage.removeItem("ngnAmount");
          
          // Refresh page after 3 seconds
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      } catch (error) {
        console.error("Error checking for pending transactions:", error);
        // Silent fail - don't show error to user
      }
    };
    
    // Only check if we have a stored transaction ID and form is not being used
    const storedId = safeLocalStorage.getItem("transactionId");
    if (storedId && !ngnAmount && !walletAddress) {
      checkForPendingTransactions();
    }
  }, []); // Run once on mount

  // Validate form fields
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!ngnAmount || !isValidAmount(ngnAmount, minimumPurchase)) {
      newErrors.ngnAmount = `Minimum purchase amount is ₦${minimumPurchase.toLocaleString()}`;
    }

    if (!walletAddress || !isValidWalletOrTag(walletAddress.trim())) {
      newErrors.walletAddress =
        "Please enter a valid Base wallet address (0x...)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent submission if transaction is already completed
    if (isTransactionCompleted) {
      setToast({
        message: "Transaction already completed. Refreshing page...",
        type: "info",
        isVisible: true,
      });
      // Refresh page to generate new transaction ID
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      return;
    }

    // Prevent multiple submissions
    if (isLoading) {
      return;
    }

    // Validate form
    if (!validateForm()) {
      setToast({
        message: "Please fix the errors in the form",
        type: "error",
        isVisible: true,
      });
      return;
    }

    // Ensure transaction ID exists before proceeding
    const currentTxId = transactionId || safeLocalStorage.getItem("transactionId");
    if (!currentTxId || currentTxId.trim() === "") {
      console.log(`[PaymentForm] Transaction ID missing at submit, generating...`);
      // Generate transaction ID before proceeding
      try {
        const txIdResponse = await fetch("/api/transactions/create-id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const txIdData = await txIdResponse.json();
        if (txIdData.success && txIdData.transactionId) {
          setTransactionId(txIdData.transactionId);
          localStorage.setItem("transactionId", txIdData.transactionId);
          console.log(`[PaymentForm] Generated transaction ID: ${txIdData.transactionId}`);
        } else {
          // Fallback: generate locally
          const fallbackId = nanoid();
          setTransactionId(fallbackId);
          localStorage.setItem("transactionId", fallbackId);
          console.log(`[PaymentForm] Generated local transaction ID: ${fallbackId}`);
        }
      } catch (error) {
        console.error(`[PaymentForm] Failed to generate transaction ID:`, error);
        // Fallback: generate locally
        const fallbackId = nanoid();
        setTransactionId(fallbackId);
        localStorage.setItem("transactionId", fallbackId);
      }
    } else {
      // Ensure state is synced
      if (currentTxId !== transactionId) {
        setTransactionId(currentTxId);
      }
    }

    setIsLoading(true);

    try {
      const finalWalletAddress = walletAddress.trim();

      // Get user and validate they're logged in
      const user = getUserFromStorage();
      console.log(`[PaymentForm] User from storage:`, {
        hasUser: !!user,
        hasEmail: !!(user?.email),
        email: user?.email ? (user.email.length > 20 ? `${user.email.slice(0, 20)}...` : user.email) : "MISSING",
        userId: user?.id ? (user.id.length > 10 ? `${user.id.slice(0, 10)}...` : user.id) : "MISSING",
      });

      if (!user) {
        setModalData({
          title: "Authentication Required",
          message: "Please log in to continue with your payment.",
          type: "error",
        });
        setShowModal(true);
        setIsLoading(false);
        // Redirect to auth page
        setTimeout(() => {
          window.location.href = "/auth";
        }, 2000);
        return;
      }

      if (!user.email || user.email.trim() === "") {
        console.error(`[PaymentForm] User exists but email is missing or empty:`, user);
        setModalData({
          title: "Account Error",
          message: "Your account email is missing. Please log out and log back in.",
          type: "error",
        });
        setShowModal(true);
        setIsLoading(false);
        return;
      }

      // Generate a NEW transaction ID for this payment attempt
      // This ensures each payment attempt is unique and avoids Flutterwave duplicate reference errors
      let currentTransactionId = transactionId || safeLocalStorage.getItem("transactionId") || "";
      
      // If we have an existing transaction ID, check if it's already completed
      // If completed, generate a new one for this payment attempt
      if (currentTransactionId) {
        try {
          const checkResponse = await fetch(`/api/transactions/create-id?transactionId=${currentTransactionId}`);
          const checkData = await checkResponse.json();
          if (checkData.success && checkData.exists && checkData.status === "completed") {
            console.log(`[Flutterwave Payment] Previous transaction completed, generating new transaction ID`);
            currentTransactionId = ""; // Force generation of new ID
          }
        } catch (error) {
          console.error(`[Flutterwave Payment] Error checking transaction status:`, error);
          // Continue with existing ID or generate new one
        }
      }

      // Generate new transaction ID if needed (for fresh payment attempt)
      if (!currentTransactionId || currentTransactionId.trim() === "") {
        try {
          const txIdResponse = await fetch("/api/transactions/create-id", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          const txIdData = await txIdResponse.json();
          if (txIdData.success && txIdData.transactionId) {
            currentTransactionId = txIdData.transactionId;
            setTransactionId(currentTransactionId);
            localStorage.setItem("transactionId", currentTransactionId);
            console.log(`[Flutterwave Payment] Generated new transaction ID: ${currentTransactionId}`);
          } else {
            // Fallback: generate locally
            currentTransactionId = nanoid();
            setTransactionId(currentTransactionId);
            localStorage.setItem("transactionId", currentTransactionId);
          }
        } catch (error) {
          console.error(`[Flutterwave Payment] Failed to generate transaction ID:`, error);
          // Fallback: generate locally
          currentTransactionId = nanoid();
          setTransactionId(currentTransactionId);
          localStorage.setItem("transactionId", currentTransactionId);
        }
      }

      // Final validation
      if (!currentTransactionId || currentTransactionId.trim() === "") {
        throw new Error("Failed to generate transaction ID. Please try again.");
      }

      // Store transaction details in localStorage for auto-claim
      safeLocalStorage.setItem("transactionId", currentTransactionId);
      safeLocalStorage.setItem("walletAddress", finalWalletAddress);
      safeLocalStorage.setItem("ngnAmount", ngnAmount);

      // Create pending transaction first
      console.log(`[Flutterwave Payment] Creating transaction: ${currentTransactionId} for wallet ${finalWalletAddress}, amount: ${ngnAmount} NGN`);
      
      // Step 1: Create transaction with status "pending"
      const txResponse = await fetch("/api/transactions/create-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: currentTransactionId,
          walletAddress: finalWalletAddress,
          ngnAmount: parseFloat(ngnAmount),
          sendAmount: parseFloat(sendAmount),
          userId: user.id,
          userEmail: user.email,
        }),
      });
      
      const txData = await txResponse.json();
      if (!txResponse.ok || !txData.success) {
        throw new Error(txData.error || "Failed to create transaction");
      }
      
      // Step 2: Initialize Flutterwave payment
      // Generate unique Flutterwave transaction reference
      // IMPORTANT: Flutterwave requires UNIQUE tx_ref for EACH payment attempt
      // Format: FLW-{timestamp}-{random}-{transactionId} to ensure maximum uniqueness
      // Using timestamp first ensures chronological uniqueness
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 11); // 9 character random string
      const flutterwaveTxRef = `FLW-${timestamp}-${randomSuffix}-${currentTransactionId.substring(0, 8)}`;
      const callbackUrl = `${window.location.origin}/payment/callback?tx_ref=${flutterwaveTxRef}`;
      
      console.log(`[Flutterwave Payment] Generated unique Flutterwave txRef: ${flutterwaveTxRef}`);
      console.log(`[Flutterwave Payment] Internal transaction ID: ${currentTransactionId}`);
      console.log(`[Flutterwave Payment] Amount: ${parseFloat(ngnAmount)} NGN`);
      
      // Step 2.5: Update transaction with Flutterwave tx_ref in metadata
      // This allows the callback to find the transaction even before webhook processes it
      try {
        const updateResponse = await fetch("/api/transactions/update-metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionId: currentTransactionId,
            metadata: {
              flutterwave_tx_ref: flutterwaveTxRef,
              transaction_id: currentTransactionId,
            },
          }),
        });
        
        if (updateResponse.ok) {
          const updateData = await updateResponse.json();
          if (updateData.success) {
            console.log(`[Flutterwave Payment] ✅ Updated transaction metadata with tx_ref: ${flutterwaveTxRef}`);
          } else {
            console.error(`[Flutterwave Payment] ❌ Metadata update failed:`, updateData.error);
          }
        } else {
          const errorText = await updateResponse.text();
          console.error(`[Flutterwave Payment] ❌ Metadata update HTTP error (${updateResponse.status}):`, errorText);
        }
      } catch (updateError: any) {
        console.error(`[Flutterwave Payment] ❌ Error updating transaction metadata:`, updateError?.message || updateError);
        // Non-critical - continue with payment initialization, but log the error
      }
      
      const paymentRequest = {
        email: user.email.trim(), // User is guaranteed to exist and have email at this point
        amount: parseFloat(ngnAmount),
        txRef: flutterwaveTxRef, // Use unique Flutterwave transaction reference
        callbackUrl: callbackUrl,
        metadata: {
          transaction_id: currentTransactionId, // Our internal transaction ID (used by webhook)
          flutterwave_tx_ref: flutterwaveTxRef, // Flutterwave's unique reference
          wallet_address: finalWalletAddress,
          send_amount: sendAmount,
          user_id: user.id,
          user_email: user.email,
          user_phone: (user as any).mobile_number || "",
        },
      };

      // Validate request data before sending
      if (!paymentRequest.email || paymentRequest.email.trim() === "") {
        throw new Error("Email is required but missing");
      }
      if (isNaN(paymentRequest.amount) || paymentRequest.amount <= 0) {
        throw new Error(`Invalid amount: ${ngnAmount}`);
      }
      if (!paymentRequest.txRef || paymentRequest.txRef.trim() === "") {
        console.error(`[PaymentForm] Transaction ID validation failed:`, {
          txRef: paymentRequest.txRef,
          currentTransactionId,
          transactionId,
        });
        throw new Error("Transaction ID is required but missing. Please refresh the page and try again.");
      }

      console.log(`[Flutterwave Payment] Request payload:`, {
        email: paymentRequest.email,
        amount: paymentRequest.amount,
        txRef: paymentRequest.txRef,
        hasMetadata: !!paymentRequest.metadata,
      });

      let requestBody: string;
      try {
        requestBody = JSON.stringify(paymentRequest);
        console.log(`[Flutterwave Payment] Request body length: ${requestBody.length} bytes`);
      } catch (jsonError: any) {
        console.error(`[Flutterwave Payment] JSON stringify error:`, jsonError);
        throw new Error(`Failed to prepare request: ${jsonError.message}`);
      }

      const processResponse = await fetch("/api/flutterwave/initialize-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
      });

      if (!processResponse.ok) {
        const errorText = await processResponse.text();
        console.error("Payment processing failed:", errorText);
        // Try to parse as JSON for better error message
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || `Payment processing failed: ${processResponse.status}`);
        } catch {
          throw new Error(`Payment processing failed: ${processResponse.status} ${errorText}`);
        }
      }

      const processData = await processResponse.json();
      console.log("[Flutterwave Payment] Response:", processData);

      if (!processData.success) {
        throw new Error(processData.error || "Failed to initialize payment");
      }

      // Redirect to Flutterwave checkout page
      if (processData.authorization_url || processData.link) {
        const paymentUrl = processData.authorization_url || processData.link;
        console.log(`[Flutterwave Payment] Redirecting to: ${paymentUrl}`);
        
        // Redirect user to Flutterwave checkout
        window.location.href = paymentUrl;
      } else {
        throw new Error("No payment URL received from Flutterwave");
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      setModalData({
        title: "Payment Error",
        message: error.message || "An error occurred. Please try again.",
        type: "error",
      });
      setShowModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (
    field: "ngnAmount" | "walletAddress",
    value: string
  ) => {
    if (field === "ngnAmount") {
      setNgnAmount(value);
      // Clear error when user starts typing
      if (errors.ngnAmount) {
        setErrors((prev) => ({ ...prev, ngnAmount: undefined }));
      }
    } else if (field === "walletAddress") {
      setWalletAddress(value);
      // Clear error when user starts typing
      if (errors.walletAddress) {
        setErrors((prev) => ({ ...prev, walletAddress: undefined }));
      }
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Note: Payment checking is now handled by Flutterwave webhook
  // Users will be redirected back after payment completion

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="flex flex-col items-center">
        {/* Logo */}
        <div className="mb-6 sm:mb-8">
          {/* White logo for light mode */}
          <img 
            src="/whitelogo.png" 
            alt="FlipPay" 
            className="h-12 sm:h-16 w-auto dark:hidden"
          />
          {/* Regular logo for dark mode */}
          <img 
            src="/logo.png" 
            alt="FlipPay" 
            className="h-12 sm:h-16 w-auto hidden dark:block"
          />
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 rounded-xl shadow-lg w-full">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* NGN Amount Input */}
            <div>
              <label
                className="block text-sm sm:text-base font-medium text-slate-700 dark:text-slate-300"
                htmlFor="ngn_amount"
              >
                Enter NGN amount
              </label>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 mb-2">
                Minimum purchase: ₦{minimumPurchase.toLocaleString()}
              </p>
              <div className="mt-2 relative">
                <input
                  className={`w-full rounded-md border ${
                    errors.ngnAmount
                      ? "border-red-300 dark:border-red-600"
                      : "border-slate-300 dark:border-slate-600"
                  } bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base`}
                  id="ngn_amount"
                  name="ngn_amount"
                  placeholder={`e.g. ${minimumPurchase.toLocaleString()}`}
                  type="number"
                  min={minimumPurchase.toString()}
                  step="0.01"
                  value={ngnAmount}
                  onChange={(e) => handleInputChange("ngnAmount", e.target.value)}
                  required
                />
                {errors.ngnAmount && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.ngnAmount}
                  </p>
                )}
              </div>
            </div>

            {/* $SEND Amount Display */}
            <div>
              <label className="block text-sm sm:text-base font-medium text-slate-700 dark:text-slate-300">
                Amount of $SEND
              </label>
              <div className="mt-2 relative">
                <div className="flex items-center w-full rounded-md border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 sm:px-4 py-2.5 sm:py-3">
                  <span className="pr-2 text-slate-400 dark:text-slate-500 text-sm sm:text-base">
                    $SEND
                  </span>
                  <input
                    className="w-full bg-transparent border-0 focus:ring-0 text-slate-900 dark:text-slate-100 text-sm sm:text-base"
                    id="send_amount"
                    name="send_amount"
                    placeholder="Calculated amount"
                    readOnly
                    type="text"
                    value={sendAmount}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Rate: 1 NGN = {exchangeRate} $SEND
                </p>
              </div>
            </div>

            {/* Wallet Address Input */}
            <div>
              <label
                className="block text-sm sm:text-base font-medium text-slate-700 dark:text-slate-300"
                htmlFor="wallet_address"
              >
                Enter Send App or Base Wallet Address
              </label>
              <div className="mt-2">
                <input
                  className={`w-full rounded-md border ${
                    errors.walletAddress
                      ? "border-red-300 dark:border-red-600"
                      : "border-slate-300 dark:border-slate-600"
                  } bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base`}
                  id="wallet_address"
                  name="wallet_address"
                  placeholder="0x..."
                  type="text"
                  value={walletAddress}
                  onChange={(e) => handleInputChange("walletAddress", e.target.value)}
                  required
                />
                
                {errors.walletAddress && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.walletAddress}
                  </p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div>
              {!transactionsEnabled && (
                <div className="mb-4 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <span className="text-xl sm:text-2xl flex-shrink-0">⚠️</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-red-700 dark:text-red-300 mb-1">
                        Transactions Currently Disabled
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400">
                        Transactions are temporarily disabled. Please check back later or contact support if you have any questions.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <button
                type="submit"
                disabled={!transactionsEnabled || isLoading || !ngnAmount || !walletAddress}
                className="w-full bg-primary text-slate-900 font-bold py-3 sm:py-3 px-4 rounded-md hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                {isLoading ? "Processing..." : transactionsEnabled ? "Pay with Flutterwave" : "Transactions Disabled"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal */}
      {showModal && modalData && (
        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setModalData(null);
          }}
          title={modalData.title}
          message={modalData.message}
          type={modalData.type}
          txHash={modalData.txHash}
          explorerUrl={modalData.explorerUrl}
        />
      )}

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
      
      {/* Powered by SEND */}
      <PoweredBySEND />
      
      {/* Create Send App Account Link */}
      <div className="mt-4 sm:mt-6 text-center px-4">
        <a
          href="https://send.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition-colors underline"
        >
          Click to Create a Send App account
        </a>
      </div>
    </div>
  );
}

