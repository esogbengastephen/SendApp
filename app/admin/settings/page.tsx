"use client";

import { useState, useEffect, Fragment } from "react";
import { useAccount } from "wagmi";
import { DEPOSIT_ACCOUNT } from "@/lib/constants";
import { ALL_ADMIN_PERMISSIONS, getEffectivePermissions } from "@/lib/admin-permissions";

// Edit Admin Form Component
function EditAdminForm({ admin, availablePermissions, onSave, onCancel }: {
  admin: any;
  availablePermissions: string[];
  onSave: (updates: any) => void;
  onCancel: () => void;
}) {
  const [role, setRole] = useState<"super_admin" | "admin">(admin.role || "admin");
  const [permissions, setPermissions] = useState<string[]>(() => getEffectivePermissions(admin.permissions || []));
  const [notes, setNotes] = useState(admin.notes || "");
  const [isActive, setIsActive] = useState(admin.is_active !== false);

  const handleSave = () => {
    onSave({
      role,
      permissions: role === "super_admin" ? [] : permissions,
      notes,
      is_active: isActive,
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Edit Admin</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value as "super_admin" | "admin");
              if (e.target.value === "super_admin") {
                setPermissions([]);
              }
            }}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Status
          </label>
          <select
            value={isActive ? "active" : "inactive"}
            onChange={(e) => setIsActive(e.target.value === "active")}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      {role === "admin" && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Permissions (includes all settings tabs when &quot;Manage Settings&quot; is checked)
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPermissions([...availablePermissions])}
                className="text-xs text-primary hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setPermissions([])}
                className="text-xs text-slate-500 hover:underline"
              >
                Clear all
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {availablePermissions.map((permission) => (
              <label key={permission} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={permissions.includes(permission)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setPermissions([...permissions, permission]);
                    } else {
                      setPermissions(permissions.filter((p) => p !== permission));
                    }
                  }}
                  className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                />
                <span className="text-xs text-slate-700 dark:text-slate-300">
                  {permission.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes about this admin..."
          rows={2}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="bg-primary text-slate-900 font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity text-sm"
        >
          Save Changes
        </button>
        <button
          onClick={onCancel}
          className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium px-4 py-2 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { address } = useAccount();
  const [exchangeRate, setExchangeRate] = useState("50"); // NGN to SEND (1 NGN = X SEND)
  const [sendToNgnRate, setSendToNgnRate] = useState("45"); // SEND to NGN (1 SEND = Y NGN)
  const [transactionsEnabled, setTransactionsEnabled] = useState(true);
  const [minimumPurchase, setMinimumPurchase] = useState<number>(3000);
  const [minimumOfframpSEND, setMinimumOfframpSEND] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [savingTransactionsStatus, setSavingTransactionsStatus] = useState(false);
  const [savingMinimumPurchase, setSavingMinimumPurchase] = useState(false);
  const [savingMinimumOfframp, setSavingMinimumOfframp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [updatingField, setUpdatingField] = useState<"ngnToSend" | "sendToNgn" | null>(null);
  const [coingeckoPrice, setCoingeckoPrice] = useState<{ usd: number; ngn: number | null } | null>(null);
  const [loadingCoingecko, setLoadingCoingecko] = useState(false);
  const [coingeckoError, setCoingeckoError] = useState<string | null>(null);
  
  // Admin Management State
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [showAddAdminForm, setShowAddAdminForm] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<string | null>(null);
  const [newAdminWallet, setNewAdminWallet] = useState("");
  const [newAdminRole, setNewAdminRole] = useState<"super_admin" | "admin">("admin");
  const [newAdminPermissions, setNewAdminPermissions] = useState<string[]>([]);
  const [newAdminNotes, setNewAdminNotes] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);
  
  // Fee Tier Management State
  const [feeTiers, setFeeTiers] = useState([
    { tier_name: "tier_1", min_amount: 3000, max_amount: 10000, fee_ngn: 250 },
    { tier_name: "tier_2", min_amount: 10001, max_amount: 50000, fee_ngn: 500 },
    { tier_name: "tier_3", min_amount: 50001, max_amount: null, fee_ngn: 1000 },
  ]);
  const [savingFeeTiers, setSavingFeeTiers] = useState(false);
  const [loadingFeeTiers, setLoadingFeeTiers] = useState(false);

  // All grantable permissions (one per sidebar tab) – from admin-permissions
  const availablePermissions = ALL_ADMIN_PERMISSIONS;

  // Fetch current settings on mount
  useEffect(() => {
    fetchSettings();
    fetchCoingeckoPrice();
    checkSuperAdmin();
    if (address) {
      fetchAdmins();
      fetchFeeTiers();
    }
  }, [address]);
  
  // Fetch fee tiers
  const fetchFeeTiers = async () => {
    if (!address) return;
    setLoadingFeeTiers(true);
    try {
      const response = await fetch(`/api/admin/fee-tiers?adminWallet=${address}`);
      const data = await response.json();
      if (data.success && data.tiers) {
        setFeeTiers(data.tiers.map((tier: any) => ({
          tier_name: tier.tier_name,
          min_amount: parseFloat(tier.min_amount.toString()),
          max_amount: tier.max_amount ? parseFloat(tier.max_amount.toString()) : null,
          fee_ngn: parseFloat(tier.fee_ngn.toString()),
        })));
      }
    } catch (error) {
      console.error("Error fetching fee tiers:", error);
    } finally {
      setLoadingFeeTiers(false);
    }
  };
  
  // Save fee tiers
  const saveFeeTiers = async () => {
    if (!address) return;
    setSavingFeeTiers(true);
    try {
      const response = await fetch("/api/admin/fee-tiers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminWallet: address,
          tiers: feeTiers,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || "Failed to save fee tiers");
        setTimeout(() => setError(null), 5000);
      }
    } catch (error: any) {
      console.error("Error saving fee tiers:", error);
      setError(error.message || "Failed to save fee tiers");
      setTimeout(() => setError(null), 5000);
    } finally {
      setSavingFeeTiers(false);
    }
  };

  // Save minimum purchase (onramp)
  const saveMinimumPurchase = async () => {
    if (!address) return;
    setSavingMinimumPurchase(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minimumPurchase: parseFloat(minimumPurchase.toString()),
          walletAddress: address,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setAdminSuccess("Minimum purchase (onramp) updated successfully!");
        setTimeout(() => setAdminSuccess(null), 3000);
      } else {
        setAdminError(data.error || "Failed to update minimum purchase");
        setTimeout(() => setAdminError(null), 3000);
      }
    } catch (error) {
      setAdminError("Failed to update minimum purchase");
      setTimeout(() => setAdminError(null), 3000);
    } finally {
      setSavingMinimumPurchase(false);
    }
  };

  const saveMinimumOfframp = async () => {
    if (!address) return;
    setSavingMinimumOfframp(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minimumOfframpSEND: parseFloat(minimumOfframpSEND.toString()),
          walletAddress: address,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setAdminSuccess("Minimum sell (offramp) updated successfully!");
        setTimeout(() => setAdminSuccess(null), 3000);
      } else {
        setAdminError(data.error || "Failed to update minimum sell");
        setTimeout(() => setAdminError(null), 3000);
      }
    } catch (error) {
      setAdminError("Failed to update minimum sell");
      setTimeout(() => setAdminError(null), 3000);
    } finally {
      setSavingMinimumOfframp(false);
    }
  };

  const checkSuperAdmin = async () => {
    if (!address) return;
    
    try {
      // Check session for role info
      const session = localStorage.getItem("admin_session");
      if (session) {
        const sessionData = JSON.parse(session);
        if (sessionData.role === "super_admin") {
          setIsSuperAdmin(true);
          return;
        }
        // If role is not in session, it might be an old session - refresh it
        // But for now, just check if it's a super admin from env or try to fetch
      }
      
      // Check if address is in env variable (treat as super_admin)
      const envWallets = process.env.NEXT_PUBLIC_ADMIN_WALLETS?.split(",").map(a => a.trim().toLowerCase()) || [];
      if (envWallets.includes(address.toLowerCase())) {
        setIsSuperAdmin(true);
        return;
      }
      
      // For now, we'll check when fetching admins - if user can fetch admins, they're super admin
      // This is handled by the API returning 403 if not super admin
    } catch (err) {
      console.error("Error checking super admin:", err);
    }
  };

  const fetchAdmins = async () => {
    if (!address) return;
    
    setLoadingAdmins(true);
    setAdminError(null);
    
    try {
      const response = await fetch("/api/admin/admins", {
        headers: {
          Authorization: `Bearer ${address}`,
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAdmins(data.admins || []);
        // If we can fetch admins, user is super admin
        setIsSuperAdmin(true);
      } else {
        if (response.status === 403) {
          // Not super admin
          setIsSuperAdmin(false);
        } else {
          setAdminError(data.error || "Failed to fetch admins");
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch admins:", err);
      setAdminError("Failed to load admins");
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!address || !newAdminWallet) {
      setAdminError("Wallet address is required");
      return;
    }

    setAdminError(null);
    setAdminSuccess(null);

    try {
      const response = await fetch("/api/admin/admins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${address}`,
        },
        body: JSON.stringify({
          adminWalletAddress: newAdminWallet,
          role: newAdminRole,
          permissions: newAdminRole === "super_admin" ? [] : newAdminPermissions,
          notes: newAdminNotes,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAdminSuccess("Admin added successfully");
        setNewAdminWallet("");
        setNewAdminRole("admin");
        setNewAdminPermissions([]);
        setNewAdminNotes("");
        setShowAddAdminForm(false);
        fetchAdmins();
        setTimeout(() => setAdminSuccess(null), 3000);
      } else {
        setAdminError(data.error || "Failed to add admin");
      }
    } catch (err: any) {
      console.error("Failed to add admin:", err);
      setAdminError(err.message || "Failed to add admin");
    }
  };

  const handleUpdateAdmin = async (adminId: string, updates: any) => {
    if (!address) return;

    setAdminError(null);
    setAdminSuccess(null);

    try {
      const response = await fetch(`/api/admin/admins/${adminId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${address}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (data.success) {
        setAdminSuccess("Admin updated successfully");
        setEditingAdmin(null);
        fetchAdmins();
        setTimeout(() => setAdminSuccess(null), 3000);
      } else {
        setAdminError(data.error || "Failed to update admin");
      }
    } catch (err: any) {
      console.error("Failed to update admin:", err);
      setAdminError(err.message || "Failed to update admin");
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    if (!address) return;
    if (!confirm("Are you sure you want to deactivate this admin?")) return;

    setAdminError(null);
    setAdminSuccess(null);

    try {
      const response = await fetch(`/api/admin/admins/${adminId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${address}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setAdminSuccess("Admin deactivated successfully");
        fetchAdmins();
        setTimeout(() => setAdminSuccess(null), 3000);
      } else {
        setAdminError(data.error || "Failed to deactivate admin");
      }
    } catch (err: any) {
      console.error("Failed to delete admin:", err);
      setAdminError(err.message || "Failed to deactivate admin");
    }
  };

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
        // Set transactions enabled status
        setTransactionsEnabled(data.settings.transactionsEnabled !== false);
        // Set minimum purchase (onramp) and minimum offramp
        setMinimumPurchase(data.settings.minimumPurchase || 3000);
        setMinimumOfframpSEND(data.settings.minimumOfframpSEND ?? 1);
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

      {/* Transaction Status Toggle */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
          Transaction Status
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Enable or disable all user transactions across the app (onramp and offramp). When disabled, users cannot generate payment or complete any transactions anywhere.
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="cursor-pointer">
              <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                transactionsEnabled ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"
              }`}>
                <input
                  type="checkbox"
                  checked={transactionsEnabled}
                  onChange={async (e) => {
                    const newValue = e.target.checked;
                    setTransactionsEnabled(newValue);
                    setSavingTransactionsStatus(true);
                    setError(null);
                    
                    try {
                      const response = await fetch("/api/admin/settings", {
                        method: "PUT",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          transactionsEnabled: newValue,
                          walletAddress: address,
                        }),
                      });

                      const data = await response.json();

                      if (data.success) {
                        setSuccess(true);
                        setTimeout(() => setSuccess(false), 3000);
                      } else {
                        setError(data.error || "Failed to update transaction status");
                        setTransactionsEnabled(!newValue); // Revert on error
                      }
                    } catch (err: any) {
                      console.error("Failed to update transaction status:", err);
                      setError("Failed to update transaction status");
                      setTransactionsEnabled(!newValue); // Revert on error
                    } finally {
                      setSavingTransactionsStatus(false);
                    }
                  }}
                  disabled={savingTransactionsStatus || !address}
                  className="sr-only"
                />
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    transactionsEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </div>
            </label>
            <div>
              <span className={`text-sm font-medium ${
                transactionsEnabled 
                  ? "text-green-600 dark:text-green-400" 
                  : "text-red-600 dark:text-red-400"
              }`}>
                {transactionsEnabled ? "Transactions Enabled" : "Transactions Disabled"}
              </span>
              {savingTransactionsStatus && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Saving...
                </p>
              )}
            </div>
          </div>
        </div>
        {!transactionsEnabled && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">
              ⚠️ Transactions are currently disabled app-wide. Users cannot generate payments or complete any transactions (buy or sell).
            </p>
          </div>
        )}
      </div>

      {/* Minimum Purchase (Onramp) */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
          Minimum Purchase (Onramp)
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Set the minimum NGN amount users must spend when buying crypto (Naira to Crypto).
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
              min="1"
              step="1"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="3000"
            />
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Users must purchase at least ₦{minimumPurchase.toLocaleString()} to proceed with a buy transaction.
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

      {/* Minimum Sell (Offramp) */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
          Minimum Sell (Offramp)
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Set the minimum $SEND amount users must sell when converting crypto to Naira (Crypto to Naira).
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Minimum Sell ($SEND)
            </label>
            <input
              type="number"
              value={minimumOfframpSEND}
              onChange={(e) => setMinimumOfframpSEND(parseFloat(e.target.value) || 1)}
              min="0.01"
              step="0.1"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="1"
            />
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Users must sell at least {minimumOfframpSEND} $SEND to proceed with a sell transaction.
            </p>
          </div>
          <button
            onClick={saveMinimumOfframp}
            disabled={savingMinimumOfframp || !address || minimumOfframpSEND <= 0}
            className="bg-primary text-slate-900 font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {savingMinimumOfframp ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-900"></div>
                Saving...
              </>
            ) : (
              "Save Minimum Sell"
            )}
          </button>
        </div>
      </div>

      {/* Transaction Fee Tiers */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
          Transaction Fee Tiers
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Configure transaction fees based on payment amount tiers
        </p>
        {loadingFeeTiers ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {feeTiers.map((tier, index) => (
              <div key={tier.tier_name} className="border border-slate-200 dark:border-slate-700 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      Tier {index + 1}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      ₦{tier.min_amount.toLocaleString()}
                      {tier.max_amount ? ` - ₦${tier.max_amount.toLocaleString()}` : "+"}
                    </p>
                  </div>
                </div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Fee Amount (NGN)
                </label>
                <input
                  type="number"
                  value={tier.fee_ngn}
                  onChange={(e) => {
                    const newTiers = [...feeTiers];
                    newTiers[index].fee_ngn = parseFloat(e.target.value) || 0;
                    setFeeTiers(newTiers);
                  }}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            ))}
            <button
              onClick={saveFeeTiers}
              disabled={savingFeeTiers}
              className="w-full bg-primary text-slate-900 font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {savingFeeTiers ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-900"></div>
                  Saving...
                </>
              ) : (
                "Save Fee Tiers"
              )}
            </button>
          </div>
        )}
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

      {/* Admin Management - Only visible to super admin */}
      {isSuperAdmin && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Admin Management
            </h2>
            <button
              onClick={() => {
                const opening = !showAddAdminForm;
                setShowAddAdminForm(opening);
                setAdminError(null);
                setAdminSuccess(null);
                if (opening) {
                  setNewAdminRole("admin");
                  setNewAdminPermissions([...availablePermissions]);
                }
              }}
              className="bg-primary text-slate-900 font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              {showAddAdminForm ? "Cancel" : "+ Add Admin"}
            </button>
          </div>

          {/* Admin Success/Error Messages */}
          {adminSuccess && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-lg mb-4">
              <p className="text-sm text-green-600 dark:text-green-400">{adminSuccess}</p>
            </div>
          )}
          {adminError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg mb-4">
              <p className="text-sm text-red-600 dark:text-red-400">{adminError}</p>
            </div>
          )}

          {/* Add Admin Form */}
          {showAddAdminForm && (
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg mb-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Wallet Address
                </label>
                <input
                  type="text"
                  value={newAdminWallet}
                  onChange={(e) => setNewAdminWallet(e.target.value)}
                  placeholder="0x..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Role
                </label>
                <select
                  value={newAdminRole}
                  onChange={(e) => {
                    const value = e.target.value as "super_admin" | "admin";
                    setNewAdminRole(value);
                    if (value === "super_admin") {
                      setNewAdminPermissions([]);
                    } else {
                      setNewAdminPermissions([...availablePermissions]);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              {newAdminRole === "admin" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Permissions (includes all settings tabs when &quot;Manage Settings&quot; is checked)
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setNewAdminPermissions([...availablePermissions])}
                        className="text-xs text-primary hover:underline"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewAdminPermissions([])}
                        className="text-xs text-slate-500 hover:underline"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {availablePermissions.map((permission) => (
                      <label key={permission} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newAdminPermissions.includes(permission)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewAdminPermissions([...newAdminPermissions, permission]);
                            } else {
                              setNewAdminPermissions(newAdminPermissions.filter((p) => p !== permission));
                            }
                          }}
                          className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {permission.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={newAdminNotes}
                  onChange={(e) => setNewAdminNotes(e.target.value)}
                  placeholder="Additional notes about this admin..."
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <button
                onClick={handleAddAdmin}
                className="w-full bg-primary text-slate-900 font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
              >
                Add Admin
              </button>
            </div>
          )}

          {/* Admins List */}
          {loadingAdmins ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Wallet Address</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Role</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Permissions</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-500 dark:text-slate-400">
                        No admins found
                      </td>
                    </tr>
                  ) : (
                    admins.map((admin) => (
                      <Fragment key={admin.id}>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="py-3 px-4">
                            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                              {admin.wallet_address.slice(0, 10)}...{admin.wallet_address.slice(-8)}
                            </code>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              admin.role === "super_admin"
                                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                                : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            }`}>
                              {admin.role === "super_admin" ? "Super Admin" : "Admin"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {admin.role === "super_admin" ? (
                              <span className="text-xs text-slate-500 dark:text-slate-400">All permissions</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {(admin.permissions || []).slice(0, 3).map((perm: string) => (
                                  <span
                                    key={perm}
                                    className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded"
                                  >
                                    {perm.replace(/_/g, " ")}
                                  </span>
                                ))}
                                {(admin.permissions || []).length > 3 && (
                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                    +{(admin.permissions || []).length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              admin.is_active
                                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                            }`}>
                              {admin.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  if (editingAdmin === admin.id) {
                                    setEditingAdmin(null);
                                  } else {
                                    setEditingAdmin(admin.id);
                                  }
                                }}
                                className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                              >
                                {editingAdmin === admin.id ? "Cancel" : "Edit"}
                              </button>
                              {admin.wallet_address.toLowerCase() !== address?.toLowerCase() && (
                                <button
                                  onClick={() => handleDeleteAdmin(admin.id)}
                                  className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                                >
                                  Deactivate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {editingAdmin === admin.id && (
                          <tr>
                            <td colSpan={5} className="p-4 bg-slate-50 dark:bg-slate-800">
                              <EditAdminForm
                                admin={admin}
                                availablePermissions={availablePermissions}
                                onSave={(updates) => handleUpdateAdmin(admin.id, updates)}
                                onCancel={() => setEditingAdmin(null)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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

