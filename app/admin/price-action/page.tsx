"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";

type Tab = "buy" | "sell";

export default function PriceActionPage() {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>("buy");
  const [livePrices, setLivePrices] = useState<{
    SEND: number | null;
    USDC: number | null;
    USDT: number | null;
    pricesNGN?: Record<string, number | null>;
    source?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // CoinGecko, Transaction Status, Minimum Purchase (shared for BUY & SELL)
  const [coingeckoPrice, setCoingeckoPrice] = useState<{
    usd: number;
    ngn: number | null;
    USDC?: { usd: number; ngn: number | null } | null;
    USDT?: { usd: number; ngn: number | null } | null;
  } | null>(null);
  const [loadingCoingecko, setLoadingCoingecko] = useState(false);
  const [coingeckoError, setCoingeckoError] = useState<string | null>(null);
  const [onrampEnabled, setOnrampEnabled] = useState(true);
  const [offrampEnabled, setOfframpEnabled] = useState(true);
  const [minimumPurchase, setMinimumPurchase] = useState<number>(3000);
  const [saving, setSaving] = useState(false);
  const [savingOnrampStatus, setSavingOnrampStatus] = useState(false);
  const [savingOfframpStatus, setSavingOfframpStatus] = useState(false);
  const [profitNgnSend, setProfitNgnSend] = useState<string>("0");
  const [profitNgnUsdc, setProfitNgnUsdc] = useState<string>("0");
  const [profitNgnUsdt, setProfitNgnUsdt] = useState<string>("0");
  const [savingMinimumPurchase, setSavingMinimumPurchase] = useState(false);
  const [success, setSuccess] = useState(false);

  // Exchange rates (admin-set) – for BUY & SELL
  const [exchangeRate, setExchangeRate] = useState<string>(""); // 1 NGN = X $SEND
  const [sendToNgnRate, setSendToNgnRate] = useState<string>(""); // 1 $SEND = Y NGN
  const [usdcNgnRate, setUsdcNgnRate] = useState<string>(""); // 1 USDC = X NGN
  const [usdtNgnRate, setUsdtNgnRate] = useState<string>(""); // 1 USDT = X NGN
  const [savingExchangeRates, setSavingExchangeRates] = useState(false);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch("/api/token-prices");
        const data = await response.json();
        if (data.success) {
          setLivePrices({
            SEND: data.prices?.SEND ?? null,
            USDC: data.prices?.USDC ?? null,
            USDT: data.prices?.USDT ?? null,
            pricesNGN: data.pricesNGN,
            source: data.source,
          });
        } else {
          setError(data.error || "Failed to fetch prices");
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to fetch prices");
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchSettings = async () => {
    if (!address) return;
    try {
      const response = await fetch("/api/admin/settings", {
        headers: { Authorization: `Bearer ${address}` },
      });
      const data = await response.json();
      if (data.success && data.settings) {
        setOnrampEnabled(data.settings.onrampEnabled !== false);
        setOfframpEnabled(data.settings.offrampEnabled !== false);
        setMinimumPurchase(data.settings.minimumPurchase ?? 3000);
        const ngnToSend = data.settings.exchangeRate;
        if (ngnToSend != null && Number(ngnToSend) > 0) {
          setExchangeRate(Number(ngnToSend).toFixed(5));
          setSendToNgnRate((1 / Number(ngnToSend)).toFixed(2));
        }
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  };

  const fetchCoingeckoPrice = async () => {
    if (!address) return;
    setLoadingCoingecko(true);
    setCoingeckoError(null);
    try {
      const response = await fetch("/api/admin/coingecko-price", {
        headers: { Authorization: `Bearer ${address}` },
      });
      const data = await response.json();
      if (data.success && data.price) {
        setCoingeckoPrice({
          usd: data.price.usd,
          ngn: data.price.ngn,
          USDC: data.price.USDC ?? null,
          USDT: data.price.USDT ?? null,
        });
      } else {
        setCoingeckoError(data.error || "Failed to fetch CoinGecko price");
      }
    } catch (err) {
      setCoingeckoError("Failed to load CoinGecko price");
    } finally {
      setLoadingCoingecko(false);
    }
  };

  const fetchAdminTokenPrices = async () => {
    if (!address) return;
    try {
      const response = await fetch("/api/admin/token-prices", {
        headers: { Authorization: `Bearer ${address}` },
      });
      const data = await response.json();
      if (data.success && data.prices) {
        if (data.prices.USDC != null) setUsdcNgnRate(String(data.prices.USDC));
        if (data.prices.USDT != null) setUsdtNgnRate(String(data.prices.USDT));
      }
    } catch (err) {
      console.error("Failed to fetch admin token prices:", err);
    }
  };

  useEffect(() => {
    if (address) {
      fetchSettings();
      fetchCoingeckoPrice();
      fetchAdminTokenPrices();
    }
  }, [address]);

  // Auto-refresh CoinGecko prices every 30 seconds so "Publish" always uses current rate + profit
  useEffect(() => {
    if (!address) return;
    const interval = setInterval(() => fetchCoingeckoPrice(), 30000);
    return () => clearInterval(interval);
  }, [address]);

  const publishCoingeckoPrice = async () => {
    if (!address || !coingeckoPrice) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const profitSend = parseFloat(profitNgnSend) || 0;
      const baseSendToNgn = coingeckoPrice.ngn ?? coingeckoPrice.usd * 1500;
      const sendToNgn = baseSendToNgn + profitSend;
      const ngnToSend = 1 / sendToNgn;
      const settingsRes = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exchangeRate: ngnToSend, walletAddress: address }),
      });
      const settingsData = await settingsRes.json();
      if (!settingsData.success) {
        setError(settingsData.error || "Failed to publish SEND rate");
        setSaving(false);
        return;
      }
      setExchangeRate(ngnToSend.toFixed(5));
      setSendToNgnRate(sendToNgn.toFixed(2));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("exchangeRateUpdated", { detail: { rate: ngnToSend } }));
      }
      const prices: Record<string, number> = {};
      if (coingeckoPrice.USDC?.ngn != null) {
        const profitUsdc = parseFloat(profitNgnUsdc) || 0;
        prices.USDC = coingeckoPrice.USDC.ngn + profitUsdc;
      }
      if (coingeckoPrice.USDT?.ngn != null) {
        const profitUsdt = parseFloat(profitNgnUsdt) || 0;
        prices.USDT = coingeckoPrice.USDT.ngn + profitUsdt;
      }
      if (Object.keys(prices).length > 0) {
        const tokenRes = await fetch("/api/admin/token-prices", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${address}` },
          body: JSON.stringify({ prices, walletAddress: address }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.success) {
          setError(tokenData.error || "Failed to publish USDC/USDT prices");
          setSaving(false);
          return;
        }
        setUsdcNgnRate(prices.USDC != null ? String(prices.USDC) : usdcNgnRate);
        setUsdtNgnRate(prices.USDT != null ? String(prices.USDT) : usdtNgnRate);
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to publish CoinGecko price");
    } finally {
      setSaving(false);
    }
  };

  const saveMinimumPurchase = async () => {
    if (!address) return;
    setSavingMinimumPurchase(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minimumPurchase: Number(minimumPurchase),
          walletAddress: address,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || "Failed to save minimum purchase");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save minimum purchase");
    } finally {
      setSavingMinimumPurchase(false);
    }
  };

  const saveExchangeRates = async () => {
    if (!address) return;
    setSavingExchangeRates(true);
    setError(null);
    try {
      const ngnToSend = parseFloat(exchangeRate);
      if (isNaN(ngnToSend) || ngnToSend <= 0) {
        setError("Invalid NGN to SEND rate");
        setSavingExchangeRates(false);
        return;
      }
      const settingsRes = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exchangeRate: ngnToSend, walletAddress: address }),
      });
      const settingsData = await settingsRes.json();
      if (!settingsData.success) {
        setError(settingsData.error || "Failed to save SEND exchange rate");
        setSavingExchangeRates(false);
        return;
      }
      const prices: Record<string, number> = {};
      const usdc = parseFloat(usdcNgnRate);
      const usdt = parseFloat(usdtNgnRate);
      if (!isNaN(usdc) && usdc > 0) prices.USDC = usdc;
      if (!isNaN(usdt) && usdt > 0) prices.USDT = usdt;
      if (Object.keys(prices).length > 0) {
        const tokenRes = await fetch("/api/admin/token-prices", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${address}` },
          body: JSON.stringify({ prices, walletAddress: address }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.success) {
          setError(tokenData.error || "Failed to save USDC/USDT prices");
          setSavingExchangeRates(false);
          return;
        }
      }
      setSuccess(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("exchangeRateUpdated", { detail: { rate: ngnToSend } }));
      }
      fetchAdminTokenPrices();
      const pricesRes = await fetch("/api/token-prices");
      const pricesData = await pricesRes.json();
      if (pricesData.success) {
        setLivePrices({
          SEND: pricesData.prices?.SEND ?? null,
          USDC: pricesData.prices?.USDC ?? null,
          USDT: pricesData.prices?.USDT ?? null,
          pricesNGN: pricesData.pricesNGN,
          source: pricesData.source,
        });
      }
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save exchange rates");
    } finally {
      setSavingExchangeRates(false);
    }
  };

  const handleOnrampToggle = async (newValue: boolean) => {
    if (!address) return;
    setOnrampEnabled(newValue);
    setSavingOnrampStatus(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onrampEnabled: newValue, walletAddress: address }),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || "Failed to update onramp status");
        setOnrampEnabled(!newValue);
      }
    } catch (err) {
      setOnrampEnabled(!newValue);
      setError("Failed to update onramp status");
    } finally {
      setSavingOnrampStatus(false);
    }
  };

  const handleOfframpToggle = async (newValue: boolean) => {
    if (!address) return;
    setOfframpEnabled(newValue);
    setSavingOfframpStatus(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offrampEnabled: newValue, walletAddress: address }),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || "Failed to update offramp status");
        setOfframpEnabled(!newValue);
      }
    } catch (err) {
      setOfframpEnabled(!newValue);
      setError("Failed to update offramp status");
    } finally {
      setSavingOfframpStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Price Action
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 sm:mt-2">
          View live token prices and price-related metrics. Manage rates in Settings or Token Prices.
        </p>
      </div>

      {/* SELL / BUY Tabs (Offramp / Onramp) */}
      <div className="flex gap-0 rounded-lg border border-slate-200 dark:border-slate-700 p-1 bg-slate-100 dark:bg-slate-800 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("buy")}
          className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === "buy"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <span className="material-icons-outlined text-lg">arrow_downward</span>
          BUY (Onramp)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("sell")}
          className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === "sell"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <span className="material-icons-outlined text-lg">arrow_upward</span>
          SELL (Offramp)
        </button>
      </div>

      {/* Tab description */}
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {activeTab === "buy"
          ? "Onramp: users buy crypto (SEND, USDC, USDT) with NGN. Prices below apply to buy orders."
          : "Offramp: users sell crypto for NGN. Prices below apply to sell orders."}
      </p>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-800 dark:text-green-200 text-sm font-medium">Settings saved successfully.</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 text-sm font-medium">{error}</p>
        </div>
      )}

      {/* CoinGecko Price – at top for BUY & SELL */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
          CoinGecko Price
        </h2>
        <div className="space-y-4">
          {loadingCoingecko ? (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span className="text-sm">Fetching price from CoinGecko...</span>
            </div>
          ) : coingeckoError ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{coingeckoError}</p>
              <button
                onClick={fetchCoingeckoPrice}
                className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
              >
                Retry
              </button>
            </div>
          ) : coingeckoPrice ? (
            <div className="space-y-3">
              {/* SEND – own line + Profit (NGN) */}
              <div className="pt-0">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Current Price (SEND)</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      ${coingeckoPrice.usd.toFixed(6)} USD
                    </p>
                    {coingeckoPrice.ngn != null && (
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        ≈ ₦{coingeckoPrice.ngn.toFixed(2)} NGN
                      </p>
                    )}
                  </div>
                  <button
                    onClick={fetchCoingeckoPrice}
                    disabled={loadingCoingecko}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Profit (NGN)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={profitNgnSend}
                    onChange={(e) => setProfitNgnSend(e.target.value)}
                    placeholder="0"
                    disabled={saving}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Added to SEND rate in NGN when publishing (1 $SEND = CoinGecko NGN + this profit).
                  </p>
                </div>
              </div>

              {/* USDC – own line + Profit (NGN) */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Current Price (USDC)</p>
                  {coingeckoPrice.USDC ? (
                    <>
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        ${coingeckoPrice.USDC.usd.toFixed(4)} USD
                      </p>
                      {coingeckoPrice.USDC.ngn != null && (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          ≈ ₦{coingeckoPrice.USDC.ngn.toFixed(2)} NGN
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">—</p>
                  )}
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Profit (NGN)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={profitNgnUsdc}
                    onChange={(e) => setProfitNgnUsdc(e.target.value)}
                    placeholder="0"
                    disabled={saving}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Added to USDC rate in NGN when publishing (1 USDC = CoinGecko NGN + this profit).
                  </p>
                </div>
              </div>

              {/* USDT – own line + Profit (NGN) */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Current Price (USDT)</p>
                  {coingeckoPrice.USDT ? (
                    <>
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        ${coingeckoPrice.USDT.usd.toFixed(4)} USD
                      </p>
                      {coingeckoPrice.USDT.ngn != null && (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          ≈ ₦{coingeckoPrice.USDT.ngn.toFixed(2)} NGN
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">—</p>
                  )}
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Profit (NGN)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={profitNgnUsdt}
                    onChange={(e) => setProfitNgnUsdt(e.target.value)}
                    placeholder="0"
                    disabled={saving}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Added to USDT rate in NGN when publishing (1 USDT = CoinGecko NGN + this profit).
                  </p>
                </div>
              </div>

              <button
                onClick={publishCoingeckoPrice}
                disabled={saving || !coingeckoPrice}
                className="w-full bg-primary text-slate-900 font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-900"></div>
                    Publishing...
                  </>
                ) : (
                  "Publish CoinGecko with Profit"
                )}
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This will overwrite the current exchange rate with CoinGecko price (plus profit if set).
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400">No price data available. Connect wallet and refresh.</p>
          )}
        </div>
      </div>

      {/* Live Prices Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <span className="material-icons-outlined text-primary">show_chart</span>
          Live Token Prices
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400">Loading prices...</p>
            </div>
          </div>
        ) : livePrices ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">SEND (USD)</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {livePrices.SEND != null ? `$${livePrices.SEND.toFixed(6)}` : "—"}
              </p>
              {livePrices.pricesNGN?.SEND != null && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  ≈ ₦{livePrices.pricesNGN.SEND.toFixed(2)} NGN
                </p>
              )}
            </div>
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">USDC (USD)</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {livePrices.USDC != null ? `$${livePrices.USDC.toFixed(4)}` : "—"}
              </p>
              {livePrices.pricesNGN?.USDC != null && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  ≈ ₦{livePrices.pricesNGN.USDC.toFixed(2)} NGN
                </p>
              )}
            </div>
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">USDT (USD)</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {livePrices.USDT != null ? `$${livePrices.USDT.toFixed(4)}` : "—"}
              </p>
              {livePrices.pricesNGN?.USDT != null && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  ≈ ₦{livePrices.pricesNGN.USDT.toFixed(2)} NGN
                </p>
              )}
            </div>
          </div>
        ) : null}

        {livePrices?.source && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
            Source: {livePrices.source}
          </p>
        )}
      </div>

      {/* Exchange Rate (BUY & SELL) – Admin set prices for SEND, USDC, USDT */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
          Exchange Rate
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Set token exchange rates for {activeTab === "buy" ? "BUY (Onramp)" : "SELL (Offramp)"}. Used for NGN ↔ SEND, USDC, and USDT.
        </p>
        <div className="space-y-4">
          {/* NGN to SEND Exchange Rate */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              NGN to SEND Exchange Rate
            </label>
            <input
              type="number"
              step="0.00001"
              min="0.00001"
              value={exchangeRate}
              onChange={(e) => {
                const value = e.target.value;
                setExchangeRate(value);
                setError(null);
                const ngnToSend = parseFloat(value);
                if (!isNaN(ngnToSend) && ngnToSend > 0) {
                  setSendToNgnRate((1 / ngnToSend).toFixed(2));
                }
              }}
              placeholder="0.01754"
              disabled={savingExchangeRates}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              1 NGN = {exchangeRate || "0"} $SEND
            </p>
          </div>

          {/* $SEND to NGN Exchange Rate */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              $SEND to NGN Exchange Rate
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={sendToNgnRate}
              onChange={(e) => {
                const value = e.target.value;
                setSendToNgnRate(value);
                setError(null);
                const sendToNgn = parseFloat(value);
                if (!isNaN(sendToNgn) && sendToNgn > 0) {
                  setExchangeRate((1 / sendToNgn).toFixed(5));
                }
              }}
              placeholder="57.01"
              disabled={savingExchangeRates}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              1 $SEND = {sendToNgnRate || "0"} NGN
            </p>
          </div>

          {/* USDC to NGN Exchange Rate */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              USDC to NGN Exchange Rate
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={usdcNgnRate}
              onChange={(e) => {
                setUsdcNgnRate(e.target.value);
                setError(null);
              }}
              placeholder="1500"
              disabled={savingExchangeRates}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              1 USDC = {usdcNgnRate || "0"} NGN
            </p>
          </div>

          {/* USDT to NGN Exchange Rate */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              USDT to NGN Exchange Rate
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={usdtNgnRate}
              onChange={(e) => {
                setUsdtNgnRate(e.target.value);
                setError(null);
              }}
              placeholder="1500"
              disabled={savingExchangeRates}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              1 USDT = {usdtNgnRate || "0"} NGN
            </p>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <button
              type="button"
              onClick={saveExchangeRates}
              disabled={savingExchangeRates || !address || !exchangeRate || parseFloat(exchangeRate) <= 0}
              className="bg-primary text-slate-900 font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {savingExchangeRates ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-900"></div>
                  Saving...
                </>
              ) : (
                "Save Exchange Rates"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Onramp / Offramp transaction status (tab-specific) */}
      {activeTab === "buy" && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
            Onramp transaction status
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Enable or disable buy (onramp) only. When disabled, users cannot buy crypto with NGN. The global toggle in Settings affects all; this one affects only onramp.
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="cursor-pointer">
                <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  onrampEnabled ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"
                }`}>
                  <input
                    type="checkbox"
                    checked={onrampEnabled}
                    onChange={(e) => handleOnrampToggle(e.target.checked)}
                    disabled={savingOnrampStatus || !address}
                    className="sr-only"
                    aria-label="Toggle onramp on or off"
                  />
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      onrampEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </div>
              </label>
              <div>
                <span className={`text-sm font-medium ${
                  onrampEnabled ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}>
                  {onrampEnabled ? "Onramp enabled" : "Onramp disabled"}
                </span>
                {savingOnrampStatus && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Saving...</p>
                )}
              </div>
            </div>
          </div>
          {!onrampEnabled && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">
                Buy (onramp) is disabled. Users cannot buy crypto with NGN until this is enabled (and global transactions in Settings are enabled).
              </p>
            </div>
          )}
        </div>
      )}
      {activeTab === "sell" && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
            Offramp transaction status
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Enable or disable sell (offramp) only. When disabled, users cannot sell crypto for NGN. The global toggle in Settings affects all; this one affects only offramp.
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="cursor-pointer">
                <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  offrampEnabled ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"
                }`}>
                  <input
                    type="checkbox"
                    checked={offrampEnabled}
                    onChange={(e) => handleOfframpToggle(e.target.checked)}
                    disabled={savingOfframpStatus || !address}
                    className="sr-only"
                    aria-label="Toggle offramp on or off"
                  />
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      offrampEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </div>
              </label>
              <div>
                <span className={`text-sm font-medium ${
                  offrampEnabled ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}>
                  {offrampEnabled ? "Offramp enabled" : "Offramp disabled"}
                </span>
                {savingOfframpStatus && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Saving...</p>
                )}
              </div>
            </div>
          </div>
          {!offrampEnabled && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">
                Sell (offramp) is disabled. Users cannot sell crypto for NGN until this is enabled (and global transactions in Settings are enabled).
              </p>
            </div>
          )}
        </div>
      )}

      {/* Minimum Purchase (BUY & SELL) */}
      <div className="grid grid-cols-1 lg:grid-cols-1 space-y-4">

        {/* Minimum Purchase Amount */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
            Minimum Purchase Amount
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Set the minimum amount users must purchase in NGN to proceed with a transaction.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Minimum Purchase (NGN)
              </label>
              <input
                type="number"
                value={minimumPurchase}
                onChange={(e) => setMinimumPurchase(parseFloat(e.target.value) || 3000)}
                min={1}
                step={1}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="3000"
              />
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Users must purchase at least ₦{minimumPurchase.toLocaleString()} to proceed with a transaction.
              </p>
            </div>
            <button
              onClick={saveMinimumPurchase}
              disabled={savingMinimumPurchase || !address || minimumPurchase <= 0}
              className="bg-primary text-slate-900 font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {savingMinimumPurchase ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-900"></div>
                  Saving...
                </>
              ) : (
                "Save Minimum Purchase"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Links (tab-specific) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Related
        </h2>
        <div className="flex flex-wrap gap-3">
          {activeTab === "buy" ? (
            <>
              <Link
                href="/admin/onramp"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-medium transition-colors"
              >
                <span className="material-icons-outlined text-lg">arrow_downward</span>
                Onramp Transactions
              </Link>
              <Link
                href="/admin/token-prices"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-medium transition-colors"
              >
                <span className="material-icons-outlined text-lg">attach_money</span>
                Token Buy Prices
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/admin/offramp"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-medium transition-colors"
              >
                <span className="material-icons-outlined text-lg">arrow_upward</span>
                Offramp Transactions
              </Link>
            </>
          )}
          <Link
            href="/admin/settings"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-medium transition-colors"
          >
            <span className="material-icons-outlined text-lg">settings</span>
            Settings (SEND/NGN rate)
          </Link>
        </div>
      </div>
    </div>
  );
}
