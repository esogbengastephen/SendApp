"use client";

import { useState, useEffect } from "react";
import { getTokenBalance } from "@/lib/blockchain";

export default function TokenDistributionPage() {
  const [poolBalance, setPoolBalance] = useState<string>("0");
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState("");

  useEffect(() => {
    // TODO: Get liquidity pool address from env
    const poolAddress = process.env.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS || "";
    if (poolAddress) {
      fetchBalance(poolAddress);
    } else {
      setLoading(false);
    }
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

  const handleCheckBalance = () => {
    if (!walletAddress) return;
    setLoading(true);
    fetchBalance(walletAddress);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Token Distribution
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Monitor liquidity pool and token distributions
        </p>
      </div>

      {/* Liquidity Pool Balance */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
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
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
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
        {poolBalance !== "0" && walletAddress && (
          <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <p className="text-sm text-slate-600 dark:text-slate-400">Balance</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {parseFloat(poolBalance).toLocaleString()} SEND
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
        </div>
        <div className="p-6">
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">
            Distribution history will appear here
          </p>
        </div>
      </div>
    </div>
  );
}

