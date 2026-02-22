"use client";

import { useState, useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import { isValidWalletOrTag, isValidAmount, isValidSolanaAddress } from "@/utils/validation";
import Modal from "./Modal";
import Toast from "./Toast";
import PoweredBySEND from "./PoweredBySEND";
import { calculateSendAmount } from "@/lib/transactions";
import { getUserFromStorage } from "@/lib/session";
import { getTokenLogo } from "@/lib/logos";

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

export type PaymentNetwork = "send" | "base" | "solana";

interface PaymentFormProps {
  network?: PaymentNetwork;
}

export default function PaymentForm({ network = "send" }: PaymentFormProps) {
  const [ngnAmount, setNgnAmount] = useState<string>("");
  const [sendAmount, setSendAmount] = useState<string>("0.00");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTransactionCompleted, setIsTransactionCompleted] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(50);
  const [minimumPurchase, setMinimumPurchase] = useState<number>(3000);
  const [selectedStablecoin, setSelectedStablecoin] = useState<"USDC" | "USDT">("USDC");
  const [stablecoinPricesNGN, setStablecoinPricesNGN] = useState<{ USDC: number | null; USDT: number | null }>({ USDC: null, USDT: null });
  const [isStablecoinDropdownOpen, setIsStablecoinDropdownOpen] = useState(false);
  const stablecoinDropdownRef = useRef<HTMLDivElement>(null);
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

  // ZainPay dynamic virtual account state
  const [zainpayAccount, setZainpayAccount] = useState<{
    accountNumber: string;
    bankName: string;
    accountName: string;
    amount: number;
    transactionId: string;
  } | null>(null);
  const [isWaitingForTransfer, setIsWaitingForTransfer] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);

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

  // Fetch stablecoin prices (USDC/USDT) when network is base or solana
  useEffect(() => {
    if (network !== "base" && network !== "solana") return;
    const fetchTokenPrices = async () => {
      try {
        const response = await fetch(`/api/token-prices?t=${Date.now()}`, { cache: "no-store" });
        const data = await response.json();
        if (data.success && data.pricesNGN) {
          setStablecoinPricesNGN({
            USDC: data.pricesNGN.USDC ?? null,
            USDT: data.pricesNGN.USDT ?? null,
          });
        }
      } catch (error) {
        console.error("Failed to fetch token prices:", error);
      }
    };
    fetchTokenPrices();
    const interval = setInterval(fetchTokenPrices, 60000);
    return () => clearInterval(interval);
  }, [network]);

  // Effective exchange rate: SEND uses /api/rate; base/solana use 1/priceNGN (tokens per 1 NGN)
  const effectiveExchangeRate =
    network === "send"
      ? exchangeRate
      : (() => {
          const priceNGN = selectedStablecoin === "USDC" ? stablecoinPricesNGN.USDC : stablecoinPricesNGN.USDT;
          return priceNGN && priceNGN > 0 ? 1 / priceNGN : 0;
        })();

  // Close stablecoin dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (stablecoinDropdownRef.current && !stablecoinDropdownRef.current.contains(e.target as Node)) {
        setIsStablecoinDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Calculate crypto amount based on NGN amount and effective rate
  useEffect(() => {
    if (ngnAmount && parseFloat(ngnAmount) > 0 && effectiveExchangeRate > 0) {
      const calculated = (parseFloat(ngnAmount) * effectiveExchangeRate).toFixed(
        network === "send" ? 2 : 6
      );
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
  }, [ngnAmount, effectiveExchangeRate, network]);

  // Update transaction ID in database with amount and exchange rate
  const updateTransactionIdWithAmount = async (amount: number, sendAmt: string) => {
    if (!transactionId) return;

    try {
      const body: Record<string, unknown> = {
        transactionId,
        ngnAmount: amount,
        sendAmount: sendAmt,
      };
      if (network === "base" || network === "solana") {
        body.exchangeRate = effectiveExchangeRate;
        body.network = network;
        body.token = selectedStablecoin;
      }
      const response = await fetch("/api/transactions/create-id", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
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

  // Validate form fields (wallet validation depends on network)
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!ngnAmount || !isValidAmount(ngnAmount, minimumPurchase)) {
      newErrors.ngnAmount = `Minimum purchase amount is ₦${minimumPurchase.toLocaleString()}`;
    }

    const trimmedWallet = walletAddress.trim();
    if (network === "solana") {
      if (!trimmedWallet || !isValidSolanaAddress(trimmedWallet)) {
        newErrors.walletAddress = "Please enter a valid Solana wallet address";
      }
    } else {
      if (!trimmedWallet || !isValidWalletOrTag(trimmedWallet)) {
        newErrors.walletAddress = "Please enter a valid Base wallet address (0x...) or SendTag";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /** Poll every 8 s — calls ZainPay verify API directly so tokens distribute even if webhook fails */
  const startPollingForZainpayPayment = (txId: string) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    setIsPollingPayment(true);

    const handleSuccess = (txHash: string) => {
      clearInterval(pollingIntervalRef.current!);
      pollingIntervalRef.current = null;
      setIsPollingPayment(false);
      setIsWaitingForTransfer(false);
      setZainpayAccount(null);
      safeLocalStorage.removeItem("transactionId");
      safeLocalStorage.removeItem("walletAddress");
      safeLocalStorage.removeItem("ngnAmount");
      setModalData({
        title: "Tokens Received!",
        message: "Your transfer was confirmed and tokens have been sent to your wallet.",
        type: "success",
        txHash,
        explorerUrl: txHash ? `https://basescan.org/tx/${txHash}` : undefined,
      });
      setShowModal(true);
    };

    pollingIntervalRef.current = setInterval(async () => {
      try {
        // Primary: ask ZainPay directly if payment was received (triggers distribution)
        const verifyRes = await fetch(`/api/zainpay/verify-payment?transactionId=${txId}`);
        const verifyData = await verifyRes.json();

        if (verifyData.paid && verifyData.status === "completed" && verifyData.txHash) {
          handleSuccess(verifyData.txHash);
          return;
        }

        // Fallback: check DB in case webhook already processed it
        const dbRes = await fetch(`/api/transactions/create-id?transactionId=${txId}`);
        const dbData = await dbRes.json();
        if (dbData.success && dbData.status === "completed" && dbData.txHash) {
          handleSuccess(dbData.txHash);
        }
      } catch {
        // silent — keep polling
      }
    }, 8000);
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
      setTimeout(() => window.location.reload(), 1000);
      return;
    }

    if (isLoading) return;

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

      // Require login
      const user = getUserFromStorage();
      if (!user) {
        setModalData({
          title: "Authentication Required",
          message: "Please log in to continue with your payment.",
          type: "error",
        });
        setShowModal(true);
        setIsLoading(false);
        setTimeout(() => { window.location.href = "/auth"; }, 2000);
        return;
      }

      if (!user.email || user.email.trim() === "") {
        setModalData({
          title: "Account Error",
          message: "Your account email is missing. Please log out and log back in.",
          type: "error",
        });
        setShowModal(true);
        setIsLoading(false);
        return;
      }

      // Use existing transaction ID or let the API create one
      const currentTransactionId = transactionId || safeLocalStorage.getItem("transactionId") || "";

      // Store in localStorage for recovery
      if (currentTransactionId) {
        safeLocalStorage.setItem("transactionId", currentTransactionId);
      }
      safeLocalStorage.setItem("walletAddress", finalWalletAddress);
      safeLocalStorage.setItem("ngnAmount", ngnAmount);

      console.log(`[ZainPay] Requesting dynamic virtual account for ₦${ngnAmount}`);

      // Call ZainPay dynamic account endpoint
      const res = await fetch("/api/zainpay/create-dynamic-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: currentTransactionId || undefined,
          ngnAmount: parseFloat(ngnAmount),
          walletAddress: finalWalletAddress,
          userId: user.id,
          userEmail: user.email,
          network,
          token: (network === "base" || network === "solana") ? selectedStablecoin : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const detail = data.details ? ` (${JSON.stringify(data.details)})` : "";
        throw new Error((data.error || "Failed to generate payment account. Please try again.") + detail);
      }

      // Update transaction ID in state/localStorage if the API assigned a new one
      if (data.transactionId && data.transactionId !== transactionId) {
        setTransactionId(data.transactionId);
        safeLocalStorage.setItem("transactionId", data.transactionId);
      }

      // Show the virtual account UI
      setZainpayAccount({
        accountNumber: data.accountNumber,
        bankName: data.bankName,
        accountName: data.accountName,
        amount: data.amount,
        transactionId: data.transactionId,
      });
      setIsWaitingForTransfer(true);

      // Start polling for payment confirmation
      startPollingForZainpayPayment(data.transactionId);

    } catch (error: any) {
      console.error("[ZainPay] Payment error:", error);
      setModalData({
        title: "Payment Error",
        message: error?.message || "An error occurred. Please try again.",
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
        {/* Logo - responsive, compact on mobile */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          {/* White logo for light mode */}
          <img 
            src="/whitelogo.png" 
            alt="FlipPay" 
            className="h-10 sm:h-14 md:h-16 w-auto dark:hidden"
          />
          {/* Regular logo for dark mode */}
          <img 
            src="/logo.png" 
            alt="FlipPay" 
            className="h-10 sm:h-14 md:h-16 w-auto hidden dark:block"
          />
        </div>

        {/* Form Card - mobile-first padding, touch-friendly */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl shadow-lg w-full border border-slate-200/50 dark:border-slate-700/50">
          {/* ZainPay Virtual Account — shown after "Pay Now" is clicked */}
          {isWaitingForTransfer && zainpayAccount && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100">
                  Complete Your Transfer
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Transfer exactly{" "}
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    ₦{zainpayAccount.amount.toLocaleString()}
                  </span>{" "}
                  to the account below
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                {/* Bank */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Bank</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {zainpayAccount.bankName}
                  </span>
                </div>

                {/* Account number with copy */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Account Number</span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold tracking-widest text-slate-900 dark:text-white">
                      {zainpayAccount.accountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(zainpayAccount.accountNumber).then(() => {
                          setCopiedAccount(true);
                          setTimeout(() => setCopiedAccount(false), 2000);
                        });
                      }}
                      className="text-primary hover:opacity-70 transition-opacity p-1 rounded"
                      title="Copy account number"
                    >
                      {copiedAccount ? (
                        <span className="text-green-500 text-xs font-medium">Copied!</span>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Account name */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Account Name</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {zainpayAccount.accountName}
                  </span>
                </div>

                {/* Amount */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Amount to transfer</span>
                  <span className="text-base font-bold text-green-600 dark:text-green-400">
                    ₦{zainpayAccount.amount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Waiting indicator */}
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-slate-500 dark:text-slate-400">
                <svg className="animate-spin w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Waiting for your transfer…</span>
              </div>

              <p className="text-xs text-center text-slate-400 dark:text-slate-500">
                This account is for this payment only. Tokens will be sent automatically once your transfer is confirmed.
              </p>

              {/* Cancel / start over */}
              <button
                type="button"
                onClick={() => {
                  if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                  setIsWaitingForTransfer(false);
                  setZainpayAccount(null);
                  setIsPollingPayment(false);
                }}
                className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline transition-colors"
              >
                Cancel — start over
              </button>
            </div>
          )}

          <form className={`space-y-5 sm:space-y-6${isWaitingForTransfer ? " hidden" : ""}`} onSubmit={handleSubmit}>
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

            {/* USDC / USDT dropdown - only for Base and Solana */}
            {(network === "base" || network === "solana") && (
              <div ref={stablecoinDropdownRef} className="relative">
                <label className="block text-sm sm:text-base font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Select stablecoin
                </label>
                <button
                  type="button"
                  onClick={() => setIsStablecoinDropdownOpen((v) => !v)}
                  className="w-full flex items-center gap-2 min-h-[42px] sm:min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 sm:px-3.5 sm:py-2.5 text-left"
                >
                  {getTokenLogo(selectedStablecoin) ? (
                    <img
                      src={getTokenLogo(selectedStablecoin)}
                      alt={selectedStablecoin}
                      className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500 text-sm font-medium shrink-0">{selectedStablecoin}</span>
                  )}
                  <span className="flex-1 font-medium">{selectedStablecoin}</span>
                  <span className="material-icons-outlined text-slate-500">
                    {isStablecoinDropdownOpen ? "expand_less" : "expand_more"}
                  </span>
                </button>
                {isStablecoinDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg py-1">
                    {(["USDC", "USDT"] as const).map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => {
                          setSelectedStablecoin(token);
                          setIsStablecoinDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-left"
                      >
                        {getTokenLogo(token) ? (
                          <img src={getTokenLogo(token)!} alt={token} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <span className="text-sm font-medium">{token}</span>
                        )}
                        <span className="font-medium">{token}</span>
                        {selectedStablecoin === token && (
                          <span className="material-icons-outlined text-primary text-sm ml-auto">check</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Crypto amount display - SEND or USDC/USDT */}
            <div>
              <label className="block text-sm sm:text-base font-medium text-slate-700 dark:text-slate-300">
                {network === "send" ? "Amount of $SEND" : `Amount of ${selectedStablecoin}`}
              </label>
              <div className="mt-2 relative">
                <div className="flex items-center gap-2 w-full min-h-[42px] sm:min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 sm:px-3.5 sm:py-2.5">
                  {network === "send" ? (
                    getTokenLogo("SEND") ? (
                      <img
                        src={getTokenLogo("SEND")}
                        alt="SEND"
                        className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 text-sm font-medium shrink-0">$SEND</span>
                    )
                  ) : (
                    getTokenLogo(selectedStablecoin) ? (
                      <img
                        src={getTokenLogo(selectedStablecoin)}
                        alt={selectedStablecoin}
                        className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 text-sm font-medium shrink-0">{selectedStablecoin}</span>
                    )
                  )}
                  <input
                    className="flex-1 min-w-0 bg-transparent border-0 focus:ring-0 text-slate-900 dark:text-slate-100 text-base font-medium"
                    id="send_amount"
                    name="send_amount"
                    placeholder="0.00"
                    readOnly
                    type="text"
                    value={sendAmount}
                  />
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                  {network === "send"
                    ? `Rate: 1 NGN = ${exchangeRate} $SEND`
                    : effectiveExchangeRate > 0
                      ? `Rate: 1 NGN = ${effectiveExchangeRate.toFixed(6)} ${selectedStablecoin}`
                      : `Loading rate for ${selectedStablecoin}...`}
                </p>
              </div>
            </div>

            {/* Wallet Address Input - 16px font, touch target */}
            <div>
              <label
                className="block text-sm sm:text-base font-medium text-slate-700 dark:text-slate-300"
                htmlFor="wallet_address"
              >
                {network === "solana"
                  ? "Enter Solana Wallet Address"
                  : "Enter Send App or Base Wallet Address"}
              </label>
              <div className="mt-2">
                <input
                  className={`w-full min-h-[48px] sm:min-h-[52px] rounded-lg sm:rounded-md border ${
                    errors.walletAddress
                      ? "border-red-300 dark:border-red-600"
                      : "border-slate-300 dark:border-slate-600"
                  } bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-base focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 py-3 sm:py-3.5`}
                  id="wallet_address"
                  name="wallet_address"
                  placeholder={network === "solana" ? "Solana address..." : "0x..."}
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
                disabled={
                  !transactionsEnabled ||
                  isLoading ||
                  !ngnAmount ||
                  !walletAddress ||
                  ((network === "base" || network === "solana") && effectiveExchangeRate <= 0)
                }
                className="w-full min-h-[48px] sm:min-h-[52px] bg-primary text-slate-900 font-bold py-3.5 px-4 rounded-lg sm:rounded-md hover:opacity-90 active:opacity-95 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed text-base touch-manipulation"
              >
                {isLoading ? "Processing..." : (network === "base" || network === "solana") && effectiveExchangeRate <= 0 ? "Loading rate..." : transactionsEnabled ? "Pay now" : "Transactions Disabled"}
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
      <div className="w-full mt-6 sm:mt-8">
        <PoweredBySEND />
      </div>
      
      {/* Create Send App Account Link - tap-friendly, responsive */}
      <div className="mt-4 sm:mt-6 text-center px-2 sm:px-4 w-full">
        <a
          href="https://send.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block py-3 px-4 text-xs sm:text-sm text-slate-500 dark:text-slate-400 hover:text-primary active:text-primary transition-colors underline rounded touch-manipulation"
        >
          Click to Create a Send App account
        </a>
      </div>
    </div>
  );
}

