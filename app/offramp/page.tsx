"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isUserLoggedIn, getUserFromStorage } from "@/lib/session";
import BottomNavigation from "@/components/BottomNavigation";
import { QRCodeSVG } from "qrcode.react";
import { NIGERIAN_BANKS } from "@/lib/nigerian-banks";

function OffRampPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [selectedBankCode, setSelectedBankCode] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [verifiedAccountName, setVerifiedAccountName] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [network, setNetwork] = useState<"base" | "solana">("base");
  const [networkType, setNetworkType] = useState<"send" | "base" | "solana">("base");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState("");
  const bankDropdownRef = useRef<HTMLDivElement>(null);
  const [processingPayout, setProcessingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState("");
  const [payoutSuccess, setPayoutSuccess] = useState<{ message: string; ngnAmount?: number } | null>(null);
  const [sendAmount, setSendAmount] = useState("");
  const [sellRate, setSellRate] = useState<number | null>(null);
  const [minimumOfframpSEND, setMinimumOfframpSEND] = useState<number>(1);

  const isSendFlow = networkType === "send";
  const sendAmountNum = parseFloat(sendAmount) || 0;
  const ngnAmount = sellRate != null && sellRate > 0 ? sendAmountNum * sellRate : 0;
  const meetsMinimumSell = sendAmountNum >= minimumOfframpSEND;
  const filteredBanks = bankSearchQuery.trim()
    ? NIGERIAN_BANKS.filter(
        (b) =>
          b.name.toLowerCase().includes(bankSearchQuery.toLowerCase()) ||
          b.code.includes(bankSearchQuery)
      )
    : NIGERIAN_BANKS;
  const selectedBankName = selectedBankCode
    ? NIGERIAN_BANKS.find((b) => b.code === selectedBankCode)?.name ?? ""
    : "";

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
      return;
    }
    setUser(getUserFromStorage());
    
    // Read network and type from URL parameter
    const networkParam = searchParams.get("network");
    const typeParam = searchParams.get("type");
    
    if (networkParam === "base" || networkParam === "solana") {
      setNetwork(networkParam);
    }
    
    // Set display type (send, base, or solana). Default to SEND for Crypto to Naira.
    if (typeParam === "send" || typeParam === "base" || typeParam === "solana") {
      setNetworkType(typeParam);
    } else if (networkParam === "solana") {
      setNetworkType("solana");
    } else {
      setNetworkType("send");
    }

    // Check dark mode
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();
    
    // Watch for dark mode changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [router, searchParams]);

  // Fetch sell rate (1 SEND = X NGN) and minimum offramp
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/token-prices").then((res) => res.json()),
      fetch("/api/rate").then((res) => res.json()),
    ])
      .then(([priceData, rateData]) => {
        if (cancelled) return;
        if (priceData?.success && typeof priceData.pricesNGNSell?.SEND === "number" && priceData.pricesNGNSell.SEND > 0) {
          setSellRate(priceData.pricesNGNSell.SEND);
        }
        if (rateData?.success && rateData.minimumOfframpSEND != null) {
          setMinimumOfframpSEND(Number(rateData.minimumOfframpSEND) || 1);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Close bank dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(e.target as Node)) {
        setBankDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleVerifyAccount = async () => {
    if (!accountNumber || accountNumber.replace(/\D/g, "").length !== 10 || !selectedBankCode) {
      setError("Enter account number and select bank first");
      return;
    }
    setError("");
    setVerifying(true);
    try {
      const res = await fetch("/api/flutterwave/verify-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber: accountNumber.trim().replace(/\D/g, "").slice(0, 10),
          bankCode: selectedBankCode,
        }),
      });
      const data = await res.json();
      if (data.success && data.data?.accountName) {
        setVerifiedAccountName(data.data.accountName);
      } else {
        setError(data.error || "Could not verify account");
        setVerifiedAccountName("");
      }
    } catch (e) {
      setError("Verification failed. Try again.");
      setVerifiedAccountName("");
    } finally {
      setVerifying(false);
    }
  };

  const handleContinue = async () => {
    if (!accountNumber || accountNumber.replace(/\D/g, "").length !== 10) {
      setError("Please enter a valid 10-digit account number");
      return;
    }
    if (isSendFlow && !selectedBankCode) {
      setError("Please select your bank");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (isSendFlow) {
        const response = await fetch("/api/offramp/verify-and-create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountNumber: accountNumber.trim().replace(/\D/g, "").slice(0, 10),
            bankCode: selectedBankCode,
            userEmail: user?.email,
            network: "base",
          }),
        });
        const data = await response.json();
        if (data.success) {
          setVerifiedAccountName(data.accountName ?? "");
          setWalletAddress(data.depositAddress ?? "");
          setTransactionId(data.transactionId ?? "");
          setError("");
        } else {
          const errMsg = (data.error && String(data.error).trim()) || (data.message && String(data.message).trim());
          setError(errMsg && errMsg !== "No message available" ? errMsg : "Could not verify account. Check number and bank.");
        }
        return;
      }

      const networkForApi = network;
      const response = await fetch("/api/offramp/generate-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber: accountNumber.trim().replace(/\D/g, "").slice(0, 10),
          accountName: undefined,
          bankCode: selectedBankCode || undefined,
          bankName: selectedBankName || undefined,
          userEmail: user?.email,
          network: networkForApi,
        }),
      });
      const data = await response.json();
      if (data.success) {
        let address = data.walletAddress;
        if (typeof address === "string" && networkForApi === "base" && address.includes("addressId:")) {
          const match = address.match(/(0x[a-fA-F0-9]{40})/);
          if (match) address = match[1];
        }
        if (address && address.length >= 10) {
          setWalletAddress(address);
          setTransactionId(data.transactionId);
        } else {
          setError("Invalid wallet address received. Please try again.");
        }
      } else {
        setError(data.error || data.message || "Failed to generate wallet address");
      }
    } catch (err: any) {
      setError(isSendFlow ? "Verification failed. Please try again." : "Failed to generate wallet address. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Extract clean address for display
  const getCleanAddress = (address: string) => {
    if (!address) return "";
    if (network === "base") {
      const match = address.match(/(0x[a-fA-F0-9]{40})/);
      return match ? match[1] : address;
    }
    return address;
  };

  const handleIHaveTransferred = async () => {
    if (!transactionId || !user?.email) {
      setPayoutError("Session missing. Please refresh and try again.");
      return;
    }
    setPayoutError("");
    setPayoutSuccess(null);
    setProcessingPayout(true);
    try {
      const res = await fetch("/api/offramp/trigger-payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, userEmail: user.email }),
      });
      const data = await res.json();
      if (data.success) {
        setPayoutSuccess({
          message: data.message || "Processing complete. Naira has been sent to your bank account.",
          ngnAmount: data.ngnAmount,
        });
      } else {
        setPayoutError(data.error || "Processing failed. Try again or wait for automatic payout.");
      }
    } catch (err: any) {
      setPayoutError(err?.message || "Request failed. Try again.");
    } finally {
      setProcessingPayout(false);
    }
  };

  const cleanAddress = getCleanAddress(walletAddress);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Show a better notification with dark mode support
    const notification = document.createElement("div");
    notification.className = "fixed top-4 right-4 bg-green-500 dark:bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50";
    notification.textContent = "✓ Copied to clipboard!";
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.remove();
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-4 pb-20">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push("/")}
            className="text-gray-900 dark:text-white text-lg font-bold hover:opacity-80 transition-opacity"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Crypto to Naira</h1>
          <div className="w-10"></div>
        </div>

        {/* Form Card - onramp-style layout */}
        <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg border border-slate-200/50 dark:border-slate-700/50 mb-4">
          {!walletAddress ? (
            <>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-5">
                Sell $SEND for Naira
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="space-y-5 sm:space-y-6">
                {/* 1. Enter amount of $SEND to sell */}
                <div>
                  <label className="block text-sm sm:text-base font-medium text-slate-700 dark:text-slate-300" htmlFor="send_amount">
                    Enter amount of $SEND to sell
                  </label>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 mb-2">
                    Minimum: {minimumOfframpSEND} $SEND
                  </p>
                  <input
                    id="send_amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 100"
                    value={sendAmount}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d.]/g, "").replace(/(\.\d*)\./g, "$1");
                      setSendAmount(v);
                    }}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base min-h-[48px] focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>

                {/* 2. Amount in NGN you will get (read-only) */}
                <div>
                  <label className="block text-sm sm:text-base font-medium text-slate-700 dark:text-slate-300">
                    Amount in NGN you will get
                  </label>
                  <div className="mt-2 flex items-center gap-2 w-full min-h-[48px] rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 sm:px-4 py-2.5 sm:py-3">
                    <span className="text-base font-semibold">₦</span>
                    <span className="flex-1 text-base font-medium">
                      {sendAmountNum > 0 && sellRate != null && sellRate > 0
                        ? ngnAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : "0.00"}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                    {sellRate != null && sellRate > 0
                      ? `Rate: 1 $SEND = ₦${sellRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NGN`
                      : "Loading sell rate…"}
                  </p>
                </div>

                {/* 3. Selected Network */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Selected Network
                  </label>
                  <div className="p-3 rounded-lg border-2 border-primary dark:border-primary/50 bg-primary/10 dark:bg-primary/20">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {networkType === "send" ? "SEND" : networkType === "base" ? "BASE" : "SOLANA"}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {network === "base" ? "Smart Wallet" : "Regular Wallet"}
                    </div>
                  </div>
                </div>

                {/* 4. Account Number */}
                <div>
                  <label className="block text-sm sm:text-base font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Account Number *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={accountNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setAccountNumber(value);
                      setVerifiedAccountName("");
                    }}
                    placeholder="Enter 10-digit account number"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-primary focus:border-primary min-h-[48px] text-base"
                    maxLength={10}
                  />
                </div>

                {/* 5. Bank (SEND flow only) */}
                {isSendFlow && (
                  <div ref={bankDropdownRef} className="relative">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Bank *
                    </label>
                    <button
                      type="button"
                      onClick={() => setBankDropdownOpen(!bankDropdownOpen)}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-left text-slate-900 dark:text-slate-100 min-h-[48px] text-base flex items-center justify-between"
                    >
                      <span className={selectedBankName ? "" : "text-slate-500 dark:text-slate-400"}>
                        {selectedBankName || "Select bank"}
                      </span>
                      <span className="material-icons-outlined text-slate-500">expand_more</span>
                    </button>
                    {bankDropdownOpen && (
                      <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg max-h-56 overflow-hidden">
                        <input
                          type="text"
                          value={bankSearchQuery}
                          onChange={(e) => setBankSearchQuery(e.target.value)}
                          placeholder="Search banks..."
                          className="w-full px-3 py-2 border-b border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                        />
                        <div className="overflow-y-auto max-h-44">
                          {filteredBanks.map((bank) => (
                            <button
                              key={bank.code}
                              type="button"
                              onClick={() => {
                                setSelectedBankCode(bank.code);
                                setBankDropdownOpen(false);
                                setBankSearchQuery("");
                                setVerifiedAccountName("");
                              }}
                              className="w-full px-3 py-2.5 text-left text-sm text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              {bank.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Verify account (SEND flow) */}
                {isSendFlow && (
                  <>
                    <button
                      type="button"
                      onClick={handleVerifyAccount}
                      disabled={verifying || accountNumber.replace(/\D/g, "").length !== 10 || !selectedBankCode}
                      className="w-full px-4 py-3 rounded-lg border-2 border-primary text-primary dark:text-primary font-semibold hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] text-base"
                    >
                      {verifying ? "Verifying…" : "Verify account"}
                    </button>
                    {verifiedAccountName && (
                      <div className="rounded-lg border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3">
                        <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-1">Account name</p>
                        <p className="text-base font-semibold text-green-900 dark:text-green-100">{verifiedAccountName}</p>
                      </div>
                    )}
                  </>
                )}

                {/* 7. Continue */}
                {isSendFlow && sendAmountNum > 0 && !meetsMinimumSell && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Minimum sell amount is {minimumOfframpSEND} $SEND.
                  </p>
                )}
                <button
                  onClick={handleContinue}
                  disabled={
                    loading ||
                    accountNumber.replace(/\D/g, "").length !== 10 ||
                    (isSendFlow && (!selectedBankCode || !verifiedAccountName || !meetsMinimumSell))
                  }
                  className="w-full min-h-[48px] sm:min-h-[52px] bg-primary text-slate-900 dark:text-white font-bold py-3.5 px-4 rounded-lg hover:opacity-90 active:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary text-base"
                >
                  {loading ? (isSendFlow ? "Verifying…" : "Generating…") : isSendFlow ? "Continue" : "Generate Wallet Address"}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Send Crypto to This Address
              </h2>

              {verifiedAccountName && (
                <div className="mb-4 rounded-lg border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3">
                  <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-1">Payout account name</p>
                  <p className="text-base font-semibold text-green-900 dark:text-green-100">{verifiedAccountName}</p>
                </div>
              )}

              <div className="space-y-6">
                {/* Network Badge */}
                <div className="flex items-center justify-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 dark:bg-primary/20 border-2 border-primary/30 dark:border-primary/50 rounded-full">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <span className="font-semibold text-primary dark:text-primary">
                      {networkType === "send" ? "Send Token" : networkType === "base" ? "Base Network" : "Solana Network"}
                    </span>
                  </div>
                </div>

                {/* QR Code Section */}
                {cleanAddress && (
                  <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 border-2 border-gray-200 dark:border-white/5 shadow-lg">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
                        <QRCodeSVG
                          value={cleanAddress}
                          size={200}
                          level="H"
                          includeMargin={true}
                          fgColor={isDarkMode ? "#ffffff" : "#1a1a1a"}
                          bgColor={isDarkMode ? "#1f2937" : "#ffffff"}
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        Scan to send crypto to this address
                      </p>
                    </div>
                  </div>
                )}

                {/* Wallet Address Section */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border-2 border-gray-200 dark:border-white/5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Wallet Address</p>
                    <button
                      onClick={() => copyToClipboard(cleanAddress)}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-md hover:shadow-lg"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </button>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-white/5">
                    <p className="font-mono text-sm break-all text-gray-900 dark:text-white leading-relaxed">
                      {cleanAddress}
                    </p>
                  </div>
                </div>

                {/* Instructions (no transaction ID or account name) */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800/50 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-bold text-blue-900 dark:text-blue-300">Instructions</p>
                  </div>
                  <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-3 list-decimal list-inside">
                    <li className="leading-relaxed">
                      Send <span className="font-semibold">
                        {networkType === "send" ? "SEND" : networkType === "base" ? "BASE TOKENS" : "SOLANA TOKENS"}
                      </span> to the wallet address above
                      {network === "base" && " (Base network)"}
                      {network === "solana" && " (Solana network)"}
                    </li>
                    <li className="leading-relaxed">
                      NGN will be sent to your linked bank account after confirmation.
                    </li>
                  </ol>
                </div>

                {payoutError && (
                  <div className="rounded-lg border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
                    <p className="text-sm text-red-800 dark:text-red-200">{payoutError}</p>
                  </div>
                )}
                {payoutSuccess && (
                  <div className="rounded-lg border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3">
                    <p className="text-sm font-semibold text-green-800 dark:text-green-200">{payoutSuccess.message}</p>
                    {payoutSuccess.ngnAmount != null && (
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">Amount: ₦{payoutSuccess.ngnAmount.toLocaleString()}</p>
                    )}
                  </div>
                )}

                <button
                  onClick={handleIHaveTransferred}
                  disabled={processingPayout || !transactionId}
                  className="w-full bg-primary text-white dark:text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg min-h-[48px] text-base"
                >
                  {processingPayout ? "Processing…" : "I have transferred"}
                </button>

                <button
                  onClick={() => {
                    setWalletAddress("");
                    setTransactionId("");
                    setVerifiedAccountName("");
                    setAccountNumber("");
                    setSelectedBankCode("");
                    setNetwork("base");
                    setPayoutError("");
                    setPayoutSuccess(null);
                  }}
                  className="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Start New Transaction
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <BottomNavigation />
    </div>
  );
}

export default function OffRampPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      }
    >
      <OffRampPageContent />
    </Suspense>
  );
}
