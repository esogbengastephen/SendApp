"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

export default function TestTransferPage() {
  const { address } = useAccount();
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [poolBalance, setPoolBalance] = useState<string | null>(null);

  const checkPoolBalance = async () => {
    if (!address) {
      setError("Please connect your wallet");
      return;
    }

    setCheckingBalance(true);
    setError(null);
    setResult(null);

    try {
      // First verify pool configuration
      const verifyResponse = await fetch(`/api/admin/verify-pool?adminWallet=${address}`);
      const verifyData = await verifyResponse.json();

      if (verifyData.success) {
        console.log("Pool verification:", verifyData.data);
        
        // Then get balance
        const response = await fetch(`/api/admin/test-transfer?adminWallet=${address}`);
        const data = await response.json();

        if (data.success) {
          setPoolBalance(data.data.balance);
          setResult({
            type: "balance",
            message: `Pool Balance: ${data.data.balance} SEND`,
            data: {
              ...data.data,
              verification: verifyData.data,
            },
          });
          
          // Show warning if balance is 0
          if (parseFloat(data.data.balance) === 0) {
            setError(
              `Balance is 0. Pool Address: ${data.data.poolAddress}. ` +
              `Please verify this is the correct wallet address and that it has SEND tokens. ` +
              `Token Contract: ${data.data.tokenContract}`
            );
          }
        } else {
          setError(data.error || "Failed to check balance");
        }
      } else {
        setError(verifyData.error || "Failed to verify pool configuration");
      }
    } catch (err: any) {
      console.error("Error checking balance:", err);
      setError(err.message || "Failed to check balance");
    } finally {
      setCheckingBalance(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) {
      setError("Please connect your wallet");
      return;
    }

    if (!recipientAddress || !/^0x[a-fA-F0-9]{40}$/i.test(recipientAddress)) {
      setError("Please enter a valid wallet address");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/test-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: recipientAddress,
          amount: amount,
          adminWallet: address,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          type: "success",
          message: "Tokens transferred successfully!",
          data: data.data,
        });
        // Clear form
        setRecipientAddress("");
        setAmount("");
        // Refresh balance
        checkPoolBalance();
      } else {
        setError(data.error || "Transfer failed");
      }
    } catch (err: any) {
      console.error("Transfer error:", err);
      setError(err.message || "Transfer failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Test Token Transfer
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Test sending $SEND tokens from liquidity pool to a user address
        </p>
      </div>

      {/* Pool Balance Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          Liquidity Pool Balance
        </h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {poolBalance !== null ? (
              <p className="text-2xl font-bold text-primary">{poolBalance} SEND</p>
            ) : (
              <p className="text-slate-500 dark:text-slate-400">Not checked</p>
            )}
            <button
              onClick={checkPoolBalance}
              disabled={checkingBalance || !address}
              className="bg-primary text-slate-900 font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkingBalance ? "Checking..." : "Check Balance"}
            </button>
          </div>
          
          {result?.data?.verification && (
            <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg space-y-2 text-sm">
              <p className="font-semibold text-slate-900 dark:text-slate-100">Pool Information:</p>
              <p className="text-slate-600 dark:text-slate-400">
                <span className="font-medium">Pool Address:</span>{" "}
                <span className="font-mono">{result.data.poolAddress}</span>
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                <span className="font-medium">Token Contract:</span>{" "}
                <span className="font-mono">{result.data.tokenContract}</span>
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                <span className="font-medium">Network:</span> {result.data.network}
              </p>
              {result.data.verification.balanceError && (
                <p className="text-red-600 dark:text-red-400">
                  <span className="font-medium">Error:</span> {result.data.verification.balanceError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transfer Form */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          Transfer Tokens
        </h2>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg mb-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {result && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              result.type === "success"
                ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                : "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
            }`}
          >
            <p
              className={`text-sm font-medium mb-2 ${
                result.type === "success"
                  ? "text-green-600 dark:text-green-400"
                  : "text-blue-600 dark:text-blue-400"
              }`}
            >
              {result.message}
            </p>
            {result.data && (
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                {result.data.txHash && (
                  <p>
                    TX Hash:{" "}
                    <a
                      href={result.data.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {result.data.txHash.slice(0, 10)}...
                    </a>
                  </p>
                )}
                {result.data.recipientBalanceAfter && (
                  <p>Recipient Balance: {result.data.recipientBalanceAfter} SEND</p>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleTransfer} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Recipient Wallet Address
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary font-mono text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Amount (SEND)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !address}
            className="w-full bg-primary text-slate-900 font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-900"></div>
                Transferring...
              </>
            ) : (
              "Transfer Tokens"
            )}
          </button>
        </form>
      </div>

      {/* Warning */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          ⚠️ <strong>Warning:</strong> This is a test endpoint. Tokens will be sent from the
          liquidity pool. Make sure you have sufficient balance and double-check the recipient
          address.
        </p>
      </div>
    </div>
  );
}

