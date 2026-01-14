"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { getTokenLogo } from "@/lib/logos";

export default function TokenPricesPage() {
  const { address } = useAccount();
  const [prices, setPrices] = useState({
    SEND: "",
    USDC: "",
    USDT: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [priceDetails, setPriceDetails] = useState<Record<string, { price: number; updated_at: string; updated_by: string | null }>>({});

  useEffect(() => {
    if (address) {
      fetchPrices();
    }
  }, [address]);

  const fetchPrices = async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/admin/token-prices", {
        headers: {
          Authorization: `Bearer ${address}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        // Set prices for editing
        setPrices({
          SEND: data.prices.SEND ? data.prices.SEND.toString() : "",
          USDC: data.prices.USDC ? data.prices.USDC.toString() : "",
          USDT: data.prices.USDT ? data.prices.USDT.toString() : "",
        });
        if (data.priceDetails) {
          setPriceDetails(data.priceDetails);
        }
      } else {
        setError(data.error || "Failed to fetch token prices");
      }
    } catch (err: any) {
      console.error("Error fetching token prices:", err);
      setError(err.message || "Failed to fetch token prices");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!address) return;

    // Validate prices
    const priceValues: Record<string, number> = {};
    let hasError = false;

    for (const [token, priceStr] of Object.entries(prices)) {
      if (priceStr.trim() === "") {
        continue; // Skip empty fields
      }
      const price = parseFloat(priceStr);
      if (isNaN(price) || price <= 0) {
        setError(`Invalid price for ${token}. Must be a positive number.`);
        hasError = true;
        break;
      }
      priceValues[token] = price;
    }

    if (hasError) {
      return;
    }

    if (Object.keys(priceValues).length === 0) {
      setError("At least one price must be provided");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/token-prices", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${address}`,
        },
        body: JSON.stringify({
          prices: priceValues,
          walletAddress: address,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("Token prices updated successfully!");
        // Update displayed prices
        setPrices({
          SEND: data.prices.SEND ? data.prices.SEND.toString() : "",
          USDC: data.prices.USDC ? data.prices.USDC.toString() : "",
          USDT: data.prices.USDT ? data.prices.USDT.toString() : "",
        });
        // Refresh price details
        await fetchPrices();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to update token prices");
        setTimeout(() => setError(null), 5000);
      }
    } catch (err: any) {
      console.error("Error updating token prices:", err);
      setError(err.message || "Failed to update token prices");
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const formatWalletAddress = (address: string | null) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading token prices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Token Buy Prices
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 sm:mt-2">
          Manage buy prices for SEND, USDC, and USDT tokens in Nigerian Naira (NGN)
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-800 dark:text-green-200 text-sm font-medium">{success}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Price Management Form */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Update Buy Prices
        </h2>

        <div className="space-y-4">
          {/* SEND Token */}
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <img
                src={getTokenLogo("SEND")}
                alt="SEND"
                className="w-12 h-12 rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://via.placeholder.com/48";
                }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                SEND Token (NGN)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={prices.SEND}
                onChange={(e) => setPrices({ ...prices, SEND: e.target.value })}
                placeholder="Enter buy price in NGN"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              />
              {priceDetails.SEND && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Last updated: {formatDate(priceDetails.SEND.updated_at)} by {formatWalletAddress(priceDetails.SEND.updated_by)}
                </p>
              )}
            </div>
          </div>

          {/* USDC Token */}
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <img
                src={getTokenLogo("USDC")}
                alt="USDC"
                className="w-12 h-12 rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://via.placeholder.com/48";
                }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                USDC Token (NGN)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={prices.USDC}
                onChange={(e) => setPrices({ ...prices, USDC: e.target.value })}
                placeholder="Enter buy price in NGN"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              />
              {priceDetails.USDC && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Last updated: {formatDate(priceDetails.USDC.updated_at)} by {formatWalletAddress(priceDetails.USDC.updated_by)}
                </p>
              )}
            </div>
          </div>

          {/* USDT Token */}
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <img
                src={getTokenLogo("USDT")}
                alt="USDT"
                className="w-12 h-12 rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://via.placeholder.com/48";
                }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                USDT Token (NGN)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={prices.USDT}
                onChange={(e) => setPrices({ ...prices, USDT: e.target.value })}
                placeholder="Enter buy price in NGN"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              />
              {priceDetails.USDT && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Last updated: {formatDate(priceDetails.USDT.updated_at)} by {formatWalletAddress(priceDetails.USDT.updated_by)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-slate-900 font-bold px-6 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Prices"}
          </button>
          <button
            onClick={fetchPrices}
            disabled={loading}
            className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium px-6 py-2 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-blue-800 dark:text-blue-200 text-sm">
          <strong>Note:</strong> These prices are used as buy prices for tokens. They will be displayed to users in the dashboard.
          Prices are stored in the database and will always be available, even if external price APIs are unavailable.
        </p>
      </div>
    </div>
  );
}
