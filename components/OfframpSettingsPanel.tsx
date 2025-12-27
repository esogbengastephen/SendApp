"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";

interface OfframpSettings {
  exchangeRate: number;
  transactionsEnabled: boolean;
  minimumAmount: number;
  maximumAmount: number;
  updatedAt: string;
  updatedBy?: string;
}

interface FeeTier {
  id?: string;
  tier_name: string;
  min_amount: number;
  max_amount: number | null;
  fee_percentage: number;
  updated_at?: string;
  updated_by?: string;
}

export default function OfframpSettingsPanel() {
  const { address } = useAccount();
  const [settings, setSettings] = useState<OfframpSettings | null>(null);
  const [feeTiers, setFeeTiers] = useState<FeeTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Form states
  const [exchangeRate, setExchangeRate] = useState<number>(1650);
  const [transactionsEnabled, setTransactionsEnabled] = useState<boolean>(true);
  const [minimumAmount, setMinimumAmount] = useState<number>(500);
  const [maximumAmount, setMaximumAmount] = useState<number>(5000000);
  const [editingTier, setEditingTier] = useState<FeeTier | null>(null);
  const [showAddTier, setShowAddTier] = useState(false);

  // Load settings on mount
  useEffect(() => {
    if (!address) return;
    loadSettings();
  }, [address]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/offramp/settings?adminWallet=${address}`);
      const data = await response.json();

      if (data.success) {
        setSettings(data.settings);
        setFeeTiers(data.feeTiers);
        setExchangeRate(data.settings.exchangeRate);
        setTransactionsEnabled(data.settings.transactionsEnabled);
        setMinimumAmount(data.settings.minimumAmount);
        setMaximumAmount(data.settings.maximumAmount);
      } else {
        setMessage({ type: "error", text: data.message || "Failed to load settings" });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      setMessage({ type: "error", text: "Failed to load settings" });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!address) return;

    try {
      setSaving(true);
      const response = await fetch("/api/admin/offramp/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminWallet: address,
          settings: {
            exchangeRate,
            transactionsEnabled,
            minimumAmount,
            maximumAmount,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: "success", text: "Settings updated successfully!" });
        setSettings(data.settings);
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: data.message || "Failed to update settings" });
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  const saveTier = async (tier: FeeTier) => {
    if (!address) return;

    try {
      setSaving(true);
      const response = await fetch("/api/admin/offramp/settings/fee-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminWallet: address,
          feeTier: tier,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: "success", text: "Fee tier updated successfully!" });
        await loadSettings();
        setEditingTier(null);
        setShowAddTier(false);
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: data.message || "Failed to update fee tier" });
      }
    } catch (error) {
      console.error("Error saving tier:", error);
      setMessage({ type: "error", text: "Failed to save fee tier" });
    } finally {
      setSaving(false);
    }
  };

  const deleteTier = async (tierId: string) => {
    if (!address || !confirm("Are you sure you want to delete this fee tier?")) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/admin/offramp/settings/fee-tier/${tierId}?adminWallet=${address}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: "success", text: "Fee tier deleted successfully!" });
        await loadSettings();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: data.message || "Failed to delete fee tier" });
      }
    } catch (error) {
      console.error("Error deleting tier:", error);
      setMessage({ type: "error", text: "Failed to delete fee tier" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-gray-600 dark:text-gray-400">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Message Banner */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
              : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Exchange Rate & Limits */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Off-Ramp Settings
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              USDC → NGN Exchange Rate
            </label>
            <input
              type="number"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              step="0.01"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              1 USDC = {exchangeRate.toFixed(2)} NGN
            </p>
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={transactionsEnabled}
                onChange={(e) => setTransactionsEnabled(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Off-Ramp Transactions
              </span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Minimum Amount (NGN)
              </label>
              <input
                type="number"
                value={minimumAmount}
                onChange={(e) => setMinimumAmount(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Maximum Amount (NGN)
              </label>
              <input
                type="number"
                value={maximumAmount}
                onChange={(e) => setMaximumAmount(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Fee Tiers */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Fee Tiers (Percentage-Based)
          </h2>
          <button
            onClick={() => {
              setEditingTier({
                tier_name: `tier_${feeTiers.length + 1}`,
                min_amount: 0,
                max_amount: null,
                fee_percentage: 1.0,
              });
              setShowAddTier(true);
            }}
            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md text-sm"
          >
            + Add Tier
          </button>
        </div>

        <div className="space-y-3">
          {feeTiers.map((tier) => {
            const isEditing = editingTier && (
              (editingTier.id && editingTier.id === tier.id) ||
              (editingTier.tier_name === tier.tier_name && !showAddTier)
            );
            
            return (
              <div
                key={tier.id || tier.tier_name}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-md"
              >
                {isEditing ? (
                  <TierForm
                    tier={editingTier}
                    onChange={setEditingTier}
                    onSave={() => editingTier && saveTier(editingTier)}
                    onCancel={() => setEditingTier(null)}
                    saving={saving}
                  />
                ) : (
                  <>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        ₦{tier.min_amount.toLocaleString()} - {tier.max_amount ? `₦${tier.max_amount.toLocaleString()}` : "Unlimited"}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Fee: {tier.fee_percentage}%
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setEditingTier(tier)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => tier.id && deleteTier(tier.id)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {showAddTier && editingTier && (
          <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-md">
            <TierForm
              tier={editingTier}
              onChange={(tier) => setEditingTier(tier)}
              onSave={() => saveTier(editingTier)}
              onCancel={() => {
                setShowAddTier(false);
                setEditingTier(null);
              }}
              saving={saving}
            />
          </div>
        )}
      </div>

      {settings && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Last updated: {new Date(settings.updatedAt).toLocaleString()} by {settings.updatedBy || "system"}
        </div>
      )}
    </div>
  );
}

// Tier editing form component
function TierForm({
  tier,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  tier: FeeTier | null;
  onChange: (tier: FeeTier) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  // Safety check - should never happen but prevents crashes
  if (!tier) {
    return null;
  }

  return (
    <div className="w-full space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Min Amount (NGN)
          </label>
          <input
            type="number"
            value={tier.min_amount}
            onChange={(e) => onChange({ ...tier, min_amount: parseFloat(e.target.value) })}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Max Amount (NGN)
          </label>
          <input
            type="number"
            value={tier.max_amount || ""}
            onChange={(e) =>
              onChange({ ...tier, max_amount: e.target.value ? parseFloat(e.target.value) : null })
            }
            placeholder="Unlimited"
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Fee (%)
          </label>
          <input
            type="number"
            value={tier.fee_percentage}
            onChange={(e) => onChange({ ...tier, fee_percentage: parseFloat(e.target.value) })}
            step="0.1"
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>
      <div className="flex space-x-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-3 rounded text-sm disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-medium py-1 px-3 rounded text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
