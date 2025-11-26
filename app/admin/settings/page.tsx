"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { DEPOSIT_ACCOUNT } from "@/lib/constants";

export default function SettingsPage() {
  const { address } = useAccount();
  const [exchangeRate, setExchangeRate] = useState("50"); // NGN to SEND (1 NGN = X SEND)
  const [sendToNgnRate, setSendToNgnRate] = useState("45"); // SEND to NGN (1 SEND = Y NGN)
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [updatingField, setUpdatingField] = useState<"ngnToSend" | "sendToNgn" | null>(null);
  const [coingeckoPrice, setCoingeckoPrice] = useState<{ usd: number; ngn: number | null } | null>(null);
  const [loadingCoingecko, setLoadingCoingecko] = useState(false);
  const [coingeckoError, setCoingeckoError] = useState<string | null>(null);
  
  // Referral program state
  const [referralUsers, setReferralUsers] = useState<any[]>([]);
  const [referralStats, setReferralStats] = useState<any>(null);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [minReferrals, setMinReferrals] = useState("");
  const [maxReferrals, setMaxReferrals] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendingBulkEmail, setSendingBulkEmail] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Fetch current settings on mount
  useEffect(() => {
    fetchSettings();
    fetchCoingeckoPrice();
    fetchReferrals();
  }, [address]);

  const fetchCoingeckoPrice = async () => {
    if (!address) return;
    
    setLoadingCoingecko(true);
    setCoingeckoError(null);
    
    try {
      const response = await fetch("/api/admin/coingecko-price", {
        headers: {
          Authorization: `Bearer ${address}`,
        },
      });

      const data = await response.json();

      if (data.success && data.price) {
        setCoingeckoPrice({
          usd: data.price.usd,
          ngn: data.price.ngn,
        });
      } else {
        setCoingeckoError(data.error || "Failed to fetch CoinGecko price");
      }
    } catch (err: any) {
      console.error("Failed to fetch CoinGecko price:", err);
      setCoingeckoError("Failed to load CoinGecko price");
    } finally {
      setLoadingCoingecko(false);
    }
  };

  const publishCoingeckoPrice = async () => {
    if (!address || !coingeckoPrice) {
      setError("CoinGecko price not available");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Calculate NGN to SEND rate from CoinGecko price
      // If 1 SEND = X NGN, then 1 NGN = 1/X SEND
      const sendToNgn = coingeckoPrice.ngn || (coingeckoPrice.usd * 1500); // Fallback calculation
      const ngnToSend = 1 / sendToNgn;

      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          exchangeRate: ngnToSend,
          walletAddress: address,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setExchangeRate(ngnToSend.toFixed(5));
        setSendToNgnRate(sendToNgn.toFixed(2));
        setTimeout(() => setSuccess(false), 3000);
        
        // Broadcast update event
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("exchangeRateUpdated", {
            detail: { rate: ngnToSend }
          }));
        }
      } else {
        setError(data.error || "Failed to publish CoinGecko price");
      }
    } catch (err: any) {
      console.error("Failed to publish CoinGecko price:", err);
      setError(err.message || "Failed to publish CoinGecko price");
    } finally {
      setSaving(false);
    }
  };

  const fetchSettings = async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/admin/settings", {
        headers: {
          Authorization: `Bearer ${address}`,
        },
      });

      const data = await response.json();

      if (data.success && data.settings) {
        const ngnToSendRate = data.settings.exchangeRate;
        setExchangeRate(ngnToSendRate.toString());
        // Calculate SEND to NGN rate (inverse)
        const calculatedSendToNgn = ngnToSendRate > 0 ? (1 / ngnToSendRate).toFixed(2) : "0";
        setSendToNgnRate(calculatedSendToNgn);
      }
    } catch (err: any) {
      console.error("Failed to fetch settings:", err);
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!address) {
      setError("Please connect your wallet");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          exchangeRate: parseFloat(exchangeRate),
          walletAddress: address,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        
        // Broadcast a custom event to notify other tabs/components about the rate update
        // This allows the payment form to refresh immediately if it's open
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("exchangeRateUpdated", {
            detail: { rate: parseFloat(exchangeRate) }
          }));
        }
      } else {
        setError(data.error || "Failed to save settings");
      }
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const fetchReferrals = async () => {
    if (!address) return;
    
    setLoadingReferrals(true);
    setSelectedUsers([]); // Clear selection when fetching new data
    try {
      const params = new URLSearchParams();
      if (minReferrals) params.append("minReferrals", minReferrals);
      if (maxReferrals) params.append("maxReferrals", maxReferrals);
      
      const response = await fetch(`/api/admin/referrals?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setReferralUsers(data.users || []);
        setReferralStats(data.stats || null);
      } else {
        setError(data.error || "Failed to fetch referral data");
      }
    } catch (err: any) {
      console.error("Failed to fetch referrals:", err);
      setError("Failed to load referral data");
    } finally {
      setLoadingReferrals(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(referralUsers.map(user => user.email));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectUser = (email: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers([...selectedUsers, email]);
    } else {
      setSelectedUsers(selectedUsers.filter(e => e !== email));
    }
  };

  const isAllSelected = referralUsers.length > 0 && selectedUsers.length === referralUsers.length;
  const isIndeterminate = selectedUsers.length > 0 && selectedUsers.length < referralUsers.length;

  const handleSendEmailToUser = async (userEmail: string) => {
    if (!emailSubject || !emailMessage) {
      setError("Please fill in email subject and message");
      return;
    }

    setSendingBulkEmail(true);
    try {
      const response = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailList: [userEmail],
          subject: emailSubject,
          message: emailMessage,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setError(null);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || "Failed to send email");
      }
    } catch (err: any) {
      console.error("Failed to send email:", err);
      setError(err.message || "Failed to send email");
    } finally {
      setSendingBulkEmail(false);
    }
  };

  const handleBulkEmail = async () => {
    if (!emailSubject || !emailMessage) {
      setError("Please fill in email subject and message");
      return;
    }

    if (selectedUsers.length === 0) {
      setError("Please select at least one user to send email to");
      return;
    }

    setSendingBulkEmail(true);
    try {
      const response = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailList: selectedUsers,
          subject: emailSubject,
          message: emailMessage,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setError(null);
        setEmailSubject("");
        setEmailMessage("");
        setSelectedUsers([]);
        setTimeout(() => setSuccess(false), 5000);
        // Refresh referral list
        fetchReferrals();
      } else {
        setError(data.error || "Failed to send bulk email");
      }
    } catch (err: any) {
      console.error("Failed to send bulk email:", err);
      setError(err.message || "Failed to send bulk email");
    } finally {
      setSendingBulkEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Settings
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 sm:mt-2">
          Configure platform settings and parameters
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
          <p className="text-sm text-green-600 dark:text-green-400">
            ✓ Settings saved successfully!
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* CoinGecko Price Section */}
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Current Price</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    ${coingeckoPrice.usd.toFixed(6)} USD
                  </p>
                  {coingeckoPrice.ngn && (
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
                  "Publish CoinGecko Price"
                )}
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This will overwrite the current exchange rate with CoinGecko price
              </p>
            </div>
          ) : (
            <div className="text-sm text-slate-600 dark:text-slate-400">
              No price data available
            </div>
          )}
        </div>
      </div>

      {/* Exchange Rate */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
          Exchange Rate
        </h2>
        <div className="space-y-4">
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
                setUpdatingField("ngnToSend");
                setError(null);
                
                // Update SEND to NGN rate (inverse)
                const ngnToSend = parseFloat(value);
                if (!isNaN(ngnToSend) && ngnToSend > 0) {
                  const calculatedSendToNgn = (1 / ngnToSend).toFixed(2);
                  setSendToNgnRate(calculatedSendToNgn);
                }
              }}
              onBlur={() => setUpdatingField(null)}
              placeholder="0.02222"
              disabled={saving}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              1 NGN = {exchangeRate || "0"} SEND
            </p>
          </div>
          
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              SEND to NGN Exchange Rate
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={sendToNgnRate}
              onChange={(e) => {
                const value = e.target.value;
                setSendToNgnRate(value);
                setUpdatingField("sendToNgn");
                setError(null);
                
                // Update NGN to SEND rate (inverse)
                const sendToNgn = parseFloat(value);
                if (!isNaN(sendToNgn) && sendToNgn > 0) {
                  const calculatedNgnToSend = (1 / sendToNgn).toFixed(5);
                  setExchangeRate(calculatedNgnToSend);
                }
              }}
              onBlur={() => setUpdatingField(null)}
              placeholder="45"
              disabled={saving}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              1 SEND = {sendToNgnRate || "0"} NGN
            </p>
          </div>
        </div>
      </div>

      {/* Deposit Account */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
          Deposit Account
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Account Name
            </label>
            <p className="text-slate-900 dark:text-slate-100">{DEPOSIT_ACCOUNT.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Account Number
            </label>
            <p className="text-slate-900 dark:text-slate-100">{DEPOSIT_ACCOUNT.accountNumber}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Bank
            </label>
            <p className="text-slate-900 dark:text-slate-100">{DEPOSIT_ACCOUNT.bank}</p>
          </div>
        </div>
      </div>

      {/* Referral Program Management */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
          Referral Program
        </h2>
        
        {/* Filters */}
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Minimum Referrals
              </label>
              <input
                type="number"
                min="0"
                value={minReferrals}
                onChange={(e) => setMinReferrals(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Maximum Referrals
              </label>
              <input
                type="number"
                min="0"
                value={maxReferrals}
                onChange={(e) => setMaxReferrals(e.target.value)}
                placeholder="No limit"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
          <button
            onClick={fetchReferrals}
            disabled={loadingReferrals}
            className="bg-primary text-slate-900 font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loadingReferrals ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-900"></div>
                Loading...
              </>
            ) : (
              "Filter Users"
            )}
          </button>
        </div>

        {/* Referral Stats */}
        {referralStats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Users</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {referralStats.totalUsers}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Referrals</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {referralStats.totalReferrals}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400">Top Referrer</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {referralStats.topReferrer?.referral_count || 0} referrals
              </p>
              {referralStats.topReferrer?.email && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {referralStats.topReferrer.email}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Users Table */}
        {referralUsers.length > 0 && (
          <div className="overflow-x-auto mb-6">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase w-12">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = isIndeterminate;
                      }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-primary bg-slate-100 border-slate-300 rounded focus:ring-primary focus:ring-2 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Referral Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Referrals
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {referralUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.email)}
                        onChange={(e) => handleSelectUser(user.email, e.target.checked)}
                        className="w-4 h-4 text-primary bg-slate-100 border-slate-300 rounded focus:ring-primary focus:ring-2 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-primary">
                      {user.referral_code}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      {user.referral_count || 0}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleSendEmailToUser(user.email)}
                        disabled={!emailSubject || !emailMessage || sendingBulkEmail}
                        className="text-xs bg-primary text-slate-900 px-3 py-1 rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Send Email
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {referralUsers.length === 0 && !loadingReferrals && (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            No users found. Try adjusting your filters.
          </div>
        )}

        {/* Bulk Email Section */}
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
            Send Bulk Email
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Email Subject
              </label>
              <input
                type="text"
                placeholder="Enter email subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Email Message
              </label>
              <textarea
                placeholder="Enter email message"
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <button
              onClick={handleBulkEmail}
              disabled={!emailSubject || !emailMessage || sendingBulkEmail || selectedUsers.length === 0}
              className="bg-primary text-slate-900 font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sendingBulkEmail ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-900"></div>
                  Sending...
                </>
              ) : (
                `Send to Selected Users (${selectedUsers.length})`
              )}
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedUsers.length > 0 
                ? `Emails will be sent to ${selectedUsers.length} selected user${selectedUsers.length === 1 ? '' : 's'}`
                : `Select users from the table above to send emails. ${referralUsers.length} user${referralUsers.length === 1 ? '' : 's'} available.`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !address || !exchangeRate || parseFloat(exchangeRate) <= 0 || !sendToNgnRate || parseFloat(sendToNgnRate) <= 0}
          className="bg-primary text-slate-900 font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-900"></div>
              Saving...
            </>
          ) : (
            "Save Settings"
          )}
        </button>
      </div>
    </div>
  );
}

