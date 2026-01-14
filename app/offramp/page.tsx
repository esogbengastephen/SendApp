"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isUserLoggedIn, getUserFromStorage } from "@/lib/session";
import BottomNavigation from "@/components/BottomNavigation";

export default function OffRampPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
      return;
    }
    setUser(getUserFromStorage());
  }, [router]);

  const handleGenerateAddress = async () => {
    if (!accountNumber || accountNumber.length !== 10) {
      setError("Please enter a valid 10-digit account number");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/offramp/generate-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber: accountNumber.trim(),
          accountName: accountName || undefined,
          bankCode: bankName || undefined,
          userEmail: user?.email,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setWalletAddress(data.walletAddress);
        setTransactionId(data.transactionId);
      } else {
        setError(data.message || "Failed to generate wallet address");
      }
    } catch (err: any) {
      setError("Failed to generate wallet address. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-primary p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push("/")}
            className="text-white text-lg font-bold"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-white">Crypto to Naira</h1>
          <div className="w-10"></div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-4">
          {!walletAddress ? (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Enter Your Bank Details
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent"
                    maxLength={10}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Enter account name"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Enter bank name"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <button
                  onClick={handleGenerateAddress}
                  disabled={loading || accountNumber.length !== 10}
                  className="w-full bg-secondary text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Generating..." : "Generate Wallet Address"}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Send Crypto to This Address
              </h2>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-2">Wallet Address</p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 font-mono text-sm break-all">
                      {walletAddress}
                    </p>
                    <button
                      onClick={() => copyToClipboard(walletAddress)}
                      className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-semibold"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {/* QR Code can be added later with qrcode.react package */}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Instructions:</strong>
                  </p>
                  <ol className="text-sm text-blue-700 mt-2 space-y-1 list-decimal list-inside">
                    <li>Send any Base token to the wallet address above</li>
                    <li>We'll automatically swap it to USDC</li>
                    <li>NGN will be sent to your account: {accountNumber}</li>
                    <li>Transaction ID: {transactionId}</li>
                  </ol>
                </div>

                <button
                  onClick={() => {
                    setWalletAddress("");
                    setTransactionId("");
                    setAccountNumber("");
                    setAccountName("");
                    setBankName("");
                  }}
                  className="w-full bg-gray-200 text-gray-800 font-semibold py-3 rounded-lg hover:bg-gray-300 transition-colors"
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
