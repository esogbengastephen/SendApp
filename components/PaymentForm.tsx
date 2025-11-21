"use client";

import { useState, useEffect } from "react";
import { nanoid } from "nanoid";

export default function PaymentForm() {
  const [ngnAmount, setNgnAmount] = useState<string>("");
  const [sendAmount, setSendAmount] = useState<string>("0.00");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Generate unique transaction ID on component mount
  useEffect(() => {
    const id = nanoid();
    setTransactionId(id);
    // Store in localStorage for persistence
    if (typeof window !== "undefined") {
      localStorage.setItem("transactionId", id);
    }
  }, []);

  // Calculate $SEND amount based on NGN amount
  useEffect(() => {
    if (ngnAmount && parseFloat(ngnAmount) > 0) {
      // TODO: Fetch real exchange rate from API
      const exchangeRate = 50; // Placeholder: 1 NGN = 50 $SEND
      const calculated = (parseFloat(ngnAmount) * exchangeRate).toFixed(2);
      setSendAmount(calculated);
    } else {
      setSendAmount("0.00");
    }
  }, [ngnAmount]);

  const handleCopyAccount = async () => {
    const accountInfo = "7034494055";
    try {
      await navigator.clipboard.writeText(accountInfo);
      // TODO: Add toast notification
      alert("Account number copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // TODO: Implement Paystack payment initialization
      console.log("Transaction ID:", transactionId);
      console.log("NGN Amount:", ngnAmount);
      console.log("Send Amount:", sendAmount);
      console.log("Wallet Address:", walletAddress);

      // Placeholder for payment flow
      alert("Payment flow will be implemented in next phase");
    } catch (error) {
      console.error("Payment error:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
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
                  className="w-full rounded-md border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2"
                  id="ngn_amount"
                  name="ngn_amount"
                  placeholder="e.g. 5000"
                  type="number"
                  min="0"
                  step="0.01"
                  value={ngnAmount}
                  onChange={(e) => setNgnAmount(e.target.value)}
                  required
                />
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
                  className="w-full rounded-md border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2"
                  id="wallet_address"
                  name="wallet_address"
                  placeholder="0x... or @username"
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  required
                />
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
    </div>
  );
}

