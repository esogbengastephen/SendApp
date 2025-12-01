"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { DEPOSIT_ACCOUNT } from "@/lib/constants";

// Edit Admin Form Component
function EditAdminForm({ admin, availablePermissions, onSave, onCancel }: {
  admin: any;
  availablePermissions: string[];
  onSave: (updates: any) => void;
  onCancel: () => void;
}) {
  const [role, setRole] = useState<"super_admin" | "admin">(admin.role || "admin");
  const [permissions, setPermissions] = useState<string[]>(admin.permissions || []);
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
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Permissions
          </label>
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
  const [saving, setSaving] = useState(false);
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

  // Available permissions
  const availablePermissions = [
    "view_dashboard",
    "manage_transactions",
    "verify_payments",
    "manage_users",
    "view_referrals",
    "manage_token_distribution",
    "test_transfers",
    "manage_settings",
  ];

  // Fetch current settings on mount
  useEffect(() => {
    fetchSettings();
    fetchCoingeckoPrice();
    checkSuperAdmin();
    if (address) {
      fetchAdmins();
    }
  }, [address]);

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

      {/* Admin Management - Only visible to super admin */}
      {isSuperAdmin && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Admin Management
            </h2>
            <button
              onClick={() => {
                setShowAddAdminForm(!showAddAdminForm);
                setAdminError(null);
                setAdminSuccess(null);
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
                    setNewAdminRole(e.target.value as "super_admin" | "admin");
                    if (e.target.value === "super_admin") {
                      setNewAdminPermissions([]);
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
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Permissions
                  </label>
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
                      <>
                        <tr key={admin.id} className="border-b border-slate-200 dark:border-slate-700">
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
                      </>
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

