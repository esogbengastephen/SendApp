"use client";

import { useState, useEffect } from "react";
import { nanoid } from "nanoid";
import { isValidWalletOrTag, isValidAmount } from "@/utils/validation";
import Modal from "./Modal";
import Toast from "./Toast";

export default function PaymentForm() {
  const [ngnAmount, setNgnAmount] = useState<string>("");
  const [sendAmount, setSendAmount] = useState<string>("0.00");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResolvingSendTag, setIsResolvingSendTag] = useState(false);
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
  } | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({ message: "", type: "info", isVisible: false });

  // Generate unique transaction ID on component mount
  useEffect(() => {
    const id = nanoid();
    setTransactionId(id);
    // Store in localStorage for persistence
    if (typeof window !== "undefined") {
      localStorage.setItem("transactionId", id);
    }
  }, []);

  // Fetch exchange rate on mount
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const response = await fetch("/api/rate");
        const data = await response.json();
        if (data.success && data.rate) {
          setExchangeRate(data.rate);
        }
      } catch (error) {
        console.error("Failed to fetch exchange rate:", error);
        // Use default rate on error
      }
    };
    fetchExchangeRate();
  }, []);

  // Calculate $SEND amount based on NGN amount
  useEffect(() => {
    if (ngnAmount && parseFloat(ngnAmount) > 0) {
      const calculated = (parseFloat(ngnAmount) * exchangeRate).toFixed(2);
      setSendAmount(calculated);
    } else {
      setSendAmount("0.00");
    }
  }, [ngnAmount, exchangeRate]);

  // Resolve SendTag to wallet address if needed
  const resolveSendTag = async (sendTag: string): Promise<string | null> => {
    try {
      setIsResolvingSendTag(true);
      const response = await fetch("/api/sendtag/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sendTag }),
      });

      const data = await response.json();
      if (data.success && data.walletAddress) {
        return data.walletAddress;
      }
      return null;
    } catch (error) {
      console.error("Failed to resolve SendTag:", error);
      return null;
    } finally {
      setIsResolvingSendTag(false);
    }
  };

  // Validate form fields
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!ngnAmount || !isValidAmount(ngnAmount)) {
      newErrors.ngnAmount = "Please enter a valid amount greater than 0";
    }

    if (!walletAddress || !isValidWalletOrTag(walletAddress.trim())) {
      newErrors.walletAddress =
        "Please enter a valid Base wallet address (0x...) or SendTag (@username)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCopyAccount = async () => {
    const accountInfo = "7034494055";
    try {
      await navigator.clipboard.writeText(accountInfo);
      setToast({
        message: "Account number copied to clipboard!",
        type: "success",
        isVisible: true,
      });
    } catch (err) {
      console.error("Failed to copy:", err);
      setToast({
        message: "Failed to copy account number",
        type: "error",
        isVisible: true,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      let finalWalletAddress = walletAddress.trim();

      // Resolve SendTag if needed
      if (finalWalletAddress.startsWith("@")) {
        const resolvedAddress = await resolveSendTag(finalWalletAddress);
        if (!resolvedAddress) {
          setModalData({
            title: "Error",
            message: "Failed to resolve SendTag. Please check the SendTag or use a wallet address instead.",
            type: "error",
          });
          setShowModal(true);
          setIsLoading(false);
          return;
        }
        finalWalletAddress = resolvedAddress;
      }

      // Initialize Paystack payment
      const response = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ngnAmount,
          sendAmount,
          walletAddress: finalWalletAddress,
          transactionId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to initialize payment");
      }

      // Redirect to Paystack payment page
      if (data.data?.authorizationUrl) {
        window.location.href = data.data.authorizationUrl;
      } else {
        throw new Error("No authorization URL received");
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
              </div>
            </div>

            {/* Wallet Address / SendTag Input */}
            <div>
              <label
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                htmlFor="wallet_address"
              >
                Enter base wallet address or send tag
              </label>
              <div className="mt-2 relative">
                <input
                  className={`w-full rounded-md border ${
                    errors.walletAddress
                      ? "border-red-300 dark:border-red-600"
                      : "border-slate-300 dark:border-slate-600"
                  } bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2`}
                  id="wallet_address"
                  name="wallet_address"
                  placeholder="0x... or @username"
                  type="text"
                  value={walletAddress}
                  onChange={(e) => handleInputChange("walletAddress", e.target.value)}
                  required
                  disabled={isResolvingSendTag}
                />
                {isResolvingSendTag && (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Resolving SendTag...
                  </p>
                )}
                {errors.walletAddress && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.walletAddress}
                  </p>
                )}
              </div>
            </div>

            {/* Deposit Account Info */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Deposit naira to this account
              </h3>
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    Eso Gbenga
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    7034494055
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-500">
                    Opay
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyAccount}
                  className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                >
                  <span className="material-icons-outlined text-xl">
                    content_copy
                  </span>
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-slate-900 font-bold py-3 px-4 rounded-md hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Processing..." : "I have sent"}
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

