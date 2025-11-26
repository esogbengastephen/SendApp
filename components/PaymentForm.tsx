"use client";

import { useState, useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import { isValidWalletOrTag, isValidAmount } from "@/utils/validation";
import Modal from "./Modal";
import Toast from "./Toast";
import { calculateSendAmount } from "@/lib/transactions";
import { getUserFromStorage } from "@/lib/session";

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
  const [isLoadingVirtualAccount, setIsLoadingVirtualAccount] = useState(true);
  const [paymentGenerated, setPaymentGenerated] = useState(false);
  const [isPollingPayment, setIsPollingPayment] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch or create virtual account when wallet address is entered
  useEffect(() => {
    const setupVirtualAccount = async () => {
      const user = getUserFromStorage();
      if (!user || !walletAddress) {
        setIsLoadingVirtualAccount(false);
        return;
      }

      try {
        console.log("[Virtual Account] Fetching virtual account for user...");
        
        // Try to get existing virtual account
        const getResponse = await fetch(
          `/api/user/virtual-account?userId=${user.id}&walletAddress=${walletAddress}`
        );
        const getData = await getResponse.json();

        if (getData.success && getData.data.hasVirtualAccount) {
          console.log("[Virtual Account] Found existing virtual account");
          setVirtualAccount({
            accountNumber: getData.data.accountNumber,
            bankName: getData.data.bankName,
            hasVirtualAccount: true,
          });
          setIsLoadingVirtualAccount(false);
          return;
        }

        // No virtual account exists, create one
        console.log("[Virtual Account] Creating new virtual account...");
        const createResponse = await fetch("/api/paystack/create-virtual-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            email: user.email,
            walletAddress: walletAddress,
          }),
        });
        const createData = await createResponse.json();

        if (createData.success) {
          console.log("[Virtual Account] ✅ Virtual account created successfully");
          setVirtualAccount({
            accountNumber: createData.data.accountNumber,
            bankName: createData.data.bankName,
            hasVirtualAccount: true,
          });
        } else {
          console.error("[Virtual Account] Failed to create:", createData.error);
        }
      } catch (error) {
        console.error("[Virtual Account] Error:", error);
      } finally {
        setIsLoadingVirtualAccount(false);
      }
    };

    // Only setup virtual account if we have a wallet address
    if (walletAddress) {
      setupVirtualAccount();
    } else {
      setIsLoadingVirtualAccount(false);
    }
  }, [walletAddress]); // Run when wallet address changes

  // Auto-claim pending transactions on mount
  useEffect(() => {
    const checkForPendingTransactions = async () => {
      // Get stored transaction ID from localStorage
      const storedTxId = localStorage.getItem("transactionId");
      if (!storedTxId) return;
      
      // Get stored wallet address and amount if available
      const storedWallet = localStorage.getItem("walletAddress");
      const storedAmount = localStorage.getItem("ngnAmount");
      
      if (!storedWallet || !storedAmount) return;
      
      // Only check if form is not being used
      if (ngnAmount || walletAddress) return;
      
      try {
        // Check if this transaction is pending and can be claimed
        const response = await fetch("/api/paystack/process-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
            body: JSON.stringify({
              transactionId: storedTxId,
              ngnAmount: storedAmount,
              sendAmount: "",
              walletAddress: storedWallet,
              // Note: exchangeRate is not sent - backend uses admin-set rate from settings
            }),
        });
        
        const data = await response.json();
        if (data.success && data.txHash) {
          // Transaction was auto-claimed!
          setModalData({
            title: "Tokens Claimed! 🎉",
            message: "Your pending transaction was automatically processed and tokens have been sent to your wallet.",
            type: "success",
            txHash: data.txHash,
            explorerUrl: data.explorerUrl,
          });
          setShowModal(true);
          
          // Clear stored transaction ID
          localStorage.removeItem("transactionId");
          localStorage.removeItem("walletAddress");
          localStorage.removeItem("ngnAmount");
          
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
    if (localStorage.getItem("transactionId") && !ngnAmount && !walletAddress) {
      checkForPendingTransactions();
    }
  }, []); // Run once on mount

  // Check for existing transaction ID in localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedId = localStorage.getItem("transactionId");
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
          localStorage.setItem("transactionId", id);
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
      if (!document.hidden) {
        console.log("[PaymentForm] Page visible, refreshing exchange rate");
        fetchExchangeRate();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Listen for exchange rate updates from admin dashboard (cross-tab communication)
    const handleRateUpdate = (event: CustomEvent) => {
      console.log("[PaymentForm] Exchange rate updated event received:", event.detail);
      fetchExchangeRate();
    };
    window.addEventListener("exchangeRateUpdated" as any, handleRateUpdate as EventListener);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("exchangeRateUpdated" as any, handleRateUpdate as EventListener);
    };
  }, []);

  // Calculate $SEND amount based on NGN amount and generate transaction ID when amount is entered
  useEffect(() => {
    if (ngnAmount && parseFloat(ngnAmount) > 0) {
      const calculated = (parseFloat(ngnAmount) * exchangeRate).toFixed(2);
      setSendAmount(calculated);

      // Generate transaction ID when user first inputs amount (if not already generated)
      if (!transactionId) {
        generateNewTransactionId();
      } else {
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
      const storedTxId = localStorage.getItem("transactionId");
      if (!storedTxId) return;
      
      // Get stored wallet address and amount if available
      const storedWallet = localStorage.getItem("walletAddress");
      const storedAmount = localStorage.getItem("ngnAmount");
      
      if (!storedWallet || !storedAmount) return;
      
      // Only check if form is not being used
      if (ngnAmount || walletAddress) return;
      
      try {
        // Check if this transaction is pending and can be claimed
        const response = await fetch("/api/paystack/process-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
            body: JSON.stringify({
              transactionId: storedTxId,
              ngnAmount: storedAmount,
              sendAmount: "",
              walletAddress: storedWallet,
              // Note: exchangeRate is not sent - backend uses admin-set rate from settings
            }),
        });
        
        const data = await response.json();
        if (data.success && data.txHash) {
          // Transaction was auto-claimed!
          setModalData({
            title: "Tokens Claimed! 🎉",
            message: "Your pending transaction was automatically processed and tokens have been sent to your wallet.",
            type: "success",
            txHash: data.txHash,
            explorerUrl: data.explorerUrl,
          });
          setShowModal(true);
          
          // Clear stored transaction ID
          localStorage.removeItem("transactionId");
          localStorage.removeItem("walletAddress");
          localStorage.removeItem("ngnAmount");
          
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
    if (localStorage.getItem("transactionId") && !ngnAmount && !walletAddress) {
      checkForPendingTransactions();
    }
  }, []); // Run once on mount

  // Validate form fields
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!ngnAmount || !isValidAmount(ngnAmount)) {
      newErrors.ngnAmount = "Please enter a valid amount greater than 0";
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

    setIsLoading(true);

    try {
      const finalWalletAddress = walletAddress.trim();

      // Store transaction details in localStorage for auto-claim
      localStorage.setItem("transactionId", transactionId);
      localStorage.setItem("walletAddress", finalWalletAddress);
      localStorage.setItem("ngnAmount", ngnAmount);

      // Store transaction and check payment in one call
      // This ensures the transaction is available when checking
      console.log(`Processing payment: ${transactionId} for wallet ${finalWalletAddress}, amount: ${ngnAmount} NGN`);
      const processResponse = await fetch("/api/paystack/process-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
          body: JSON.stringify({
            ngnAmount,
            sendAmount,
            walletAddress: finalWalletAddress,
            transactionId,
            // Note: exchangeRate is not sent - backend uses admin-set rate from settings
          }),
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
      console.log("Payment processing response:", processData);

      // Check if transaction was already completed
      if (processData.alreadyCompleted) {
        setIsTransactionCompleted(true);
        setModalData({
          title: "Transaction Already Completed",
          message: "This transaction has already been processed. Refreshing page to start a new transaction...",
          type: "info",
          txHash: processData.txHash,
          explorerUrl: processData.explorerUrl,
        });
        setShowModal(true);
        
        // Refresh page after 2 seconds to generate new transaction ID
        setTimeout(() => {
          window.location.reload();
        }, 2000);
        return;
      }

      if (processData.success) {
        // Mark transaction as completed to prevent duplicate submissions
        setIsTransactionCompleted(true);
        
        const txHash = processData.txHash;
        const explorerUrl = processData.explorerUrl || (txHash 
          ? `https://basescan.org/tx/${txHash}`
          : null);
        
        setModalData({
          title: "Success! 🎉",
          message: processData.message || "Payment verified and tokens distributed successfully! Refreshing page...",
          type: "success",
          txHash: txHash,
          explorerUrl: explorerUrl || undefined,
        });
        setShowModal(true);
        
        // Show transaction hash in toast if available
        if (txHash) {
          setToast({
            message: `Tokens sent! View transaction: ${txHash.slice(0, 10)}...`,
            type: "success",
            isVisible: true,
          });
        }
        
        // Clear form on success
        setNgnAmount("");
        setWalletAddress("");
        setSendAmount("0.00");
        
        // Refresh page after 3 seconds to generate new transaction ID
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        // Check if it's a "payment not found" error - might need to wait
        if (processData.error?.includes("Payment not found")) {
          setModalData({
            title: "Payment Not Found",
            message: processData.error + " Please wait a few minutes for the payment to be processed by your bank, then try again.",
            type: "info",
          });
        } else {
          throw new Error(processData.error || "Payment verification failed");
        }
        setShowModal(true);
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

  // Check for payment and process automatically
  const checkForPayment = async () => {
    const user = getUserFromStorage();
    if (!user || !virtualAccount?.accountNumber) return;
    
    try {
      console.log("[Payment Check] Looking for payments to account:", virtualAccount.accountNumber);
      
      // Query for any completed transactions for this user/wallet
      const response = await fetch(
        `/api/user/check-payment?userId=${user.id}&walletAddress=${walletAddress}&accountNumber=${virtualAccount.accountNumber}`
      );
      const data = await response.json();
      
      if (data.success && data.transactions && data.transactions.length > 0) {
        // Payment found!
        const latestTransaction = data.transactions[0];
        
        // Stop polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setIsPollingPayment(false);
        setIsTransactionCompleted(true);
        
        setModalData({
          title: "Payment Received! 🎉",
          message: `Your payment of ${latestTransaction.ngnAmount} NGN has been received and ${latestTransaction.sendAmount} SEND tokens have been sent to your wallet!`,
          type: "success",
          txHash: latestTransaction.txHash,
          explorerUrl: latestTransaction.txHash ? `https://basescan.org/tx/${latestTransaction.txHash}` : undefined,
        });
        setShowModal(true);
        
        // Clear stored transaction data
        localStorage.removeItem("transactionId");
        localStorage.removeItem("walletAddress");
        localStorage.removeItem("ngnAmount");
        
        // Refresh page after 3 seconds
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        console.log("[Payment Check] No completed transactions found yet");
      }
    } catch (error) {
      console.error("[Payment Check] Error:", error);
    }
  };

  return (
    <div className="w-full max-w-lg p-8">
      <div className="flex flex-col items-center">
        {/* Logo */}
        <div className="bg-primary p-5 rounded-xl mb-8">
          <span className="text-3xl font-bold text-slate-900">/s</span>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-lg w-full">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* NGN Amount Input */}
            <div>
              <label
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                htmlFor="ngn_amount"
              >
                Enter NGN amount
              </label>
              <div className="mt-2 relative">
                <input
                  className={`w-full rounded-md border ${
                    errors.ngnAmount
                      ? "border-red-300 dark:border-red-600"
                      : "border-slate-300 dark:border-slate-600"
                  } bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2`}
                  id="ngn_amount"
                  name="ngn_amount"
                  placeholder="e.g. 5000"
                  type="number"
                  min="0"
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Amount of /send
              </label>
              <div className="mt-2 relative">
                <div className="flex items-center w-full rounded-md border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2">
                  <span className="pr-2 text-slate-400 dark:text-slate-500">
                    /s
                  </span>
                  <input
                    className="w-full bg-transparent border-0 focus:ring-0 text-slate-900 dark:text-slate-100"
                    id="send_amount"
                    name="send_amount"
                    placeholder="Calculated amount"
                    readOnly
                    type="text"
                    value={sendAmount}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Rate: 1 NGN = {exchangeRate} SEND
                </p>
              </div>
            </div>

            {/* Wallet Address Input */}
            <div>
              <label
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                htmlFor="wallet_address"
              >
                Enter base wallet address
              </label>
              <div className="mt-2">
                <input
                  className={`w-full rounded-md border ${
                    errors.walletAddress
                      ? "border-red-300 dark:border-red-600"
                      : "border-slate-300 dark:border-slate-600"
                  } bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2`}
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

            {/* Deposit Account Info */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              {virtualAccount && virtualAccount.hasVirtualAccount ? (
                /* Virtual Account - Personalized */
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-primary text-2xl">🏦</span>
                    <h3 className="text-sm font-bold text-primary">
                      YOUR PERSONAL ACCOUNT
                    </h3>
                  </div>
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 p-4 rounded-lg border-2 border-primary/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Account Number</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-wider">
                          {virtualAccount.accountNumber}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(virtualAccount.accountNumber);
                            setToast({
                              message: "Account number copied!",
                              type: "success",
                              isVisible: true,
                            });
                            setTimeout(() => setToast(prev => ({ ...prev, isVisible: false })), 3000);
                          } catch (err) {
                            console.error("Failed to copy:", err);
                          }
                        }}
                        className="p-3 rounded-full bg-primary/20 hover:bg-primary/30 text-slate-900 dark:text-slate-100 transition-colors"
                      >
                        <span className="material-icons-outlined text-xl">
                          content_copy
                        </span>
                      </button>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Bank</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {virtualAccount.bankName}
                      </p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-primary/20">
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        💡 This account is unique to you. Send the exact amount and get SEND tokens instantly!
                      </p>
                    </div>
                  </div>
                </>
              ) : isLoadingVirtualAccount ? (
                /* Loading State */
                <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  <p className="text-sm">Setting up your personal account...</p>
                </div>
              ) : null}
            </div>

            {/* Submit Button */}
            <div>
              {!virtualAccount || !virtualAccount.hasVirtualAccount ? (
                /* Generate Payment Button - Shows first */
                <button
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    
                    // Validate form first
                    if (!validateForm()) {
                      setToast({
                        message: "Please fill in all fields correctly",
                        type: "error",
                        isVisible: true,
                      });
                      return;
                    }
                    
                    // Trigger virtual account creation
                    setIsLoadingVirtualAccount(true);
                    const user = getUserFromStorage();
                    
                    if (!user || !walletAddress) {
                      setToast({
                        message: "Please enter a wallet address first",
                        type: "error",
                        isVisible: true,
                      });
                      setIsLoadingVirtualAccount(false);
                      return;
                    }

                    try {
                      // Link wallet to user by creating transaction record
                      console.log("[Generate Payment] Linking wallet to user...");
                      const linkResponse = await fetch("/api/transactions/create-id", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          transactionId: transactionId,
                          walletAddress: walletAddress,
                          ngnAmount: parseFloat(ngnAmount),
                          sendAmount: parseFloat(sendAmount),
                        }),
                      });
                      
                      if (!linkResponse.ok) {
                        console.error("[Generate Payment] Failed to link wallet to user");
                      } else {
                        console.log("[Generate Payment] ✅ Wallet linked to user");
                      }
                      
                      // Create virtual account
                      const createResponse = await fetch("/api/paystack/create-virtual-account", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          userId: user.id,
                          email: user.email,
                          walletAddress: walletAddress,
                        }),
                      });
                      const createData = await createResponse.json();

                      if (createData.success) {
                        setVirtualAccount({
                          accountNumber: createData.data.accountNumber,
                          bankName: createData.data.bankName,
                          hasVirtualAccount: true,
                        });
                        setPaymentGenerated(true);
                        
                        setToast({
                          message: "✅ Payment account generated! Send payment to your account above.",
                          type: "success",
                          isVisible: true,
                        });
                      } else {
                        setToast({
                          message: createData.error || "Failed to generate payment account",
                          type: "error",
                          isVisible: true,
                        });
                      }
                    } catch (error) {
                      console.error("Error generating payment:", error);
                      setToast({
                        message: "Failed to generate payment account",
                        type: "error",
                        isVisible: true,
                      });
                    } finally {
                      setIsLoadingVirtualAccount(false);
                    }
                  }}
                  disabled={isLoadingVirtualAccount || !ngnAmount || !walletAddress}
                  className="w-full bg-primary text-slate-900 font-bold py-3 px-4 rounded-md hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingVirtualAccount ? "Generating..." : "Generate Payment"}
                </button>
              ) : (
                /* I Have Sent Button - Shows after virtual account is generated */
                <button
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    
                    if (isPollingPayment) {
                      // Stop polling
                      if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                      }
                      setIsPollingPayment(false);
                      setToast({
                        message: "Payment check stopped. Click 'I have sent' to check again.",
                        type: "info",
                        isVisible: true,
                      });
                      return;
                    }
                    
                    // Start polling for payment
                    setIsPollingPayment(true);
                    setToast({
                      message: "🔍 Checking for payment... This may take a moment.",
                      type: "info",
                      isVisible: true,
                    });
                    
                    // Check immediately first
                    await checkForPayment();
                    
                    // Set up polling interval (every 5 seconds)
                    pollingIntervalRef.current = setInterval(async () => {
                      await checkForPayment();
                    }, 5000);
                    
                    // Set 1-minute timeout to stop polling and allow retry
                    setTimeout(() => {
                      if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                      }
                      setIsPollingPayment(false);
                      
                      if (!isTransactionCompleted) {
                        setToast({
                          message: "⏱️ Payment not found yet. Please check your bank app and click 'I have sent' again if you've already sent the payment.",
                          type: "info",
                          isVisible: true,
                        });
                      }
                    }, 60000); // 60 seconds = 1 minute
                  }}
                  disabled={isTransactionCompleted}
                  className={`w-full font-bold py-3 px-4 rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ${
                    isPollingPayment
                      ? "bg-yellow-500 hover:bg-yellow-600 text-slate-900 animate-pulse"
                      : "bg-primary hover:opacity-90 text-slate-900"
                  }`}
                >
                  {isTransactionCompleted 
                    ? "✅ Payment Received - Refreshing..." 
                    : isPollingPayment 
                      ? "🔍 Checking for payment..." 
                      : "I have sent"}
                </button>
              )}
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
    </div>
  );
}

