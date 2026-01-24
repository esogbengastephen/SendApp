"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isUserLoggedIn, getUserFromStorage } from "@/lib/session";
import BottomNavigation from "@/components/BottomNavigation";
import { QRCodeSVG } from "qrcode.react";

export default function OffRampPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [network, setNetwork] = useState<"base" | "solana">("base");
  const [networkType, setNetworkType] = useState<"send" | "base" | "solana">("base");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);

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
    
    // Set display type (send, base, or solana)
    if (typeParam === "send" || typeParam === "base" || typeParam === "solana") {
      setNetworkType(typeParam);
    } else if (networkParam === "base") {
      // Default to "base" if no type specified
      setNetworkType("base");
    } else if (networkParam === "solana") {
      setNetworkType("solana");
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

  const handleGenerateAddress = async () => {
    if (!accountNumber || accountNumber.length !== 10) {
      setError("Please enter a valid 10-digit account number");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // BASE and SEND both use "base" network (SEND token is on Base network)
      // So they share the same smart wallet address
      const networkForApi = networkType === "send" ? "base" : network;

      const response = await fetch("/api/offramp/generate-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber: accountNumber.trim(),
          accountName: accountName || undefined,
          bankCode: bankName || undefined,
          bankName: bankName || undefined,
          userEmail: user?.email,
          network: networkForApi, // Always "base" for both BASE and SEND
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Extract actual address from WalletAddress object if it's a string representation
        let address = data.walletAddress;
        if (typeof address === "string") {
          // For Base network, extract 0x address from WalletAddress object if needed
          if (networkForApi === "base" && address.includes("addressId:")) {
            // Extract address from WalletAddress{ addressId: '0x...', ... }
            const match = address.match(/addressId:\s*['"](0x[a-fA-F0-9]{40})['"]/);
            if (match) {
              address = match[1];
            } else {
              // Try to extract any 0x address as fallback
              const addressMatch = address.match(/(0x[a-fA-F0-9]{40})/);
              if (addressMatch) {
                address = addressMatch[1];
              }
            }
          }
          // For Solana, the address should already be in base58 format, no extraction needed
        }
        
        if (!address || address.length < 10) {
          setError("Invalid wallet address received. Please try again.");
          return;
        }
        
        setWalletAddress(address);
        setTransactionId(data.transactionId);
      } else {
        setError(data.error || data.message || "Failed to generate wallet address");
      }
    } catch (err: any) {
      setError("Failed to generate wallet address. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Extract clean address for display
  const getCleanAddress = (address: string) => {
    if (!address) return "";
    // For Base network, extract 0x address if it's in a WalletAddress object format
    if (network === "base") {
      const match = address.match(/(0x[a-fA-F0-9]{40})/);
      return match ? match[1] : address;
    }
    // For Solana, return the address as-is (base58 format)
    return address;
        // For Solana, return the address as-is (base58 format)
        return address;
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

        {/* Form Card */}
        <div className="bg-white dark:bg-card-dark rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-white/5 mb-4">
          {!walletAddress ? (
            <>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Enter Your Bank Details
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                {/* Network Display (read-only if selected from URL) */}
                {searchParams.get("network") ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Selected Network
                    </label>
                    <div className="p-3 rounded-lg border-2 border-primary dark:border-primary/50 bg-primary/10 dark:bg-primary/20">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {networkType === "send" ? "SEND" : networkType === "base" ? "BASE" : "SOLANA"}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {network === "base" ? "Smart Wallet" : "Regular Wallet"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Network *
                    </label>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setNetwork("base")}
                        className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                          network === "base"
                            ? "border-primary dark:border-primary/50 bg-primary/10 dark:bg-primary/20"
                            : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50"
                        }`}
                      >
                        <div className="font-semibold text-gray-900 dark:text-white">Base / SEND</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Smart Wallet</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNetwork("solana")}
                        className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                          network === "solana"
                            ? "border-primary dark:border-primary/50 bg-primary/10 dark:bg-primary/20"
                            : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50"
                        }`}
                      >
                        <div className="font-semibold text-gray-900 dark:text-white">Solana</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Regular Wallet</div>
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Account Number *
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setAccountNumber(value);
                    }}
                    placeholder="Enter 10-digit account number"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                    maxLength={10}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Account Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Enter account name"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bank Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Enter bank name"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <button
                  onClick={handleGenerateAddress}
                  disabled={loading || accountNumber.length !== 10}
                  className="w-full bg-primary text-white dark:text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                  {loading ? "Generating..." : "Generate Wallet Address"}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Send Crypto to This Address
              </h2>

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

                {/* Transaction Details */}
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
                        {networkType === "send" ? "SEND TOKEN" : networkType === "base" ? "BASE TOKENS" : "SOLANA TOKENS"}
                      </span> to the wallet address above
                      <span className="font-semibold">
                        {network === "base" && " (Base network)"}
                        {network === "solana" && " (Solana network)"}
                      </span>
                    </li>
                    <li className="leading-relaxed">
                      <span className="font-semibold">NGN will be sent to your account:</span> {accountNumber}
                    </li>
                    <li className="leading-relaxed">
                      <span className="font-semibold">Transaction ID:</span> {transactionId}
                    </li>
                  </ol>
                </div>

                <button
                  onClick={() => {
                    setWalletAddress("");
                    setTransactionId("");
                    setAccountNumber("");
                    setAccountName("");
                    setBankName("");
                    setNetwork("base");
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
