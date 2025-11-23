"use client";

import { useState, useEffect } from "react";
import { getTokenBalance } from "@/lib/blockchain";

interface Distribution {
  transactionId: string;
  walletAddress: string;
  sendAmount: string;
  ngnAmount: number;
  txHash?: string;
  completedAt?: string;
}

export default function TokenDistributionPage() {
  const [poolBalance, setPoolBalance] = useState<string>("0");
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletBalance, setWalletBalance] = useState<string>("0");
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loadingDistributions, setLoadingDistributions] = useState(true);

  useEffect(() => {
    // Get liquidity pool address from env
    const poolAddress = process.env.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS || "";
    if (poolAddress) {
      fetchBalance(poolAddress);
    } else {
      setLoading(false);
    }
    
    // Fetch distribution history
    fetchDistributions();
  }, []);

  const fetchBalance = async (address: string) => {
    try {
      const response = await fetch(`/api/blockchain/balance?address=${address}`);
      const data = await response.json();
      if (data.success) {
        setPoolBalance(data.balance);
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckBalance = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/blockchain/balance?address=${walletAddress}`);
      const data = await response.json();
      if (data.success) {
        setWalletBalance(data.balance);
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDistributions = async () => {
    setLoadingDistributions(true);
    try {
      const response = await fetch("/api/admin/transactions?status=completed");
      const data = await response.json();
      
      if (data.success) {
        // Filter to only completed transactions with txHash (successful distributions)
        const completedDistributions = data.transactions
          .filter((tx: any) => tx.status === "completed" && tx.txHash)
          .map((tx: any) => ({
            transactionId: tx.transactionId,
            walletAddress: tx.walletAddress,
            sendAmount: tx.sendAmount,
            ngnAmount: tx.ngnAmount,
            txHash: tx.txHash,
            completedAt: tx.completedAt,
          }))
          .sort((a: Distribution, b: Distribution) => {
            const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
            const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
            return dateB - dateA; // Newest first
          })
          .slice(0, 50); // Show last 50 distributions
        
        setDistributions(completedDistributions);
      }
    } catch (error) {
      console.error("Error fetching distributions:", error);
    } finally {
      setLoadingDistributions(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Token Distribution
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 sm:mt-2">
          Monitor liquidity pool and token distributions
        </p>
      </div>

      {/* Liquidity Pool Balance */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
          Liquidity Pool Balance
        </h2>
        <div className="flex items-center gap-4">
          <div className="bg-primary p-4 rounded-lg">
            <span className="material-icons-outlined text-slate-900 text-3xl">
              account_balance_wallet
            </span>
          </div>
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Available Balance</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {loading ? "Loading..." : `${parseFloat(poolBalance).toLocaleString()} SEND`}
            </p>
          </div>
        </div>
      </div>

      {/* Check Wallet Balance */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
          Check Wallet Balance
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Enter Base wallet address (0x...)"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <button
            onClick={handleCheckBalance}
            disabled={loading || !walletAddress}
            className="bg-primary text-slate-900 font-bold px-6 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Check Balance
          </button>
        </div>
        {walletAddress && (
          <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <p className="text-sm text-slate-600 dark:text-slate-400">Balance</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {loading ? "Loading..." : `${parseFloat(walletBalance).toLocaleString()} SEND`}
            </p>
          </div>
        )}
      </div>

      {/* Distribution History */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Recent Distributions
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Showing {distributions.length} completed token distributions
          </p>
        </div>
        <div className="overflow-x-auto">
          {loadingDistributions ? (
            <div className="p-6 text-center text-slate-500">
              Loading distribution history...
            </div>
          ) : distributions.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              No distributions found
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Wallet Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Transaction
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {distributions.map((dist) => (
                  <tr key={dist.transactionId} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                      {dist.completedAt
                        ? new Date(dist.completedAt).toLocaleString()
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-mono text-slate-900 dark:text-slate-100 max-w-xs truncate">
                        {dist.walletAddress}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {dist.sendAmount} SEND
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        ₦{dist.ngnAmount.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {dist.txHash ? (
                        <a
                          href={`https://basescan.org/tx/${dist.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:opacity-70 transition-opacity text-sm font-mono"
                        >
                          {dist.txHash.substring(0, 10)}...
                        </a>
                      ) : (
                        <span className="text-slate-400 text-sm">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

