"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getUserFromStorage } from "@/lib/session";
import { authenticateWithPasskey } from "@/lib/passkey";
import { decryptSeedPhrase } from "@/lib/wallet";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import { getChainLogo } from "@/lib/logos";
import { getKYCTierInfo, canUpgradeTier, formatCurrency, type KYCTier, KYC_TIERS } from "@/lib/kyc-tiers";

// Add Phone Number Form Component
function AddPhoneNumberForm({ onSuccess, userId }: { onSuccess: () => void; userId: string }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!userId) {
      setError("User ID is missing. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/flutterwave/add-phone-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, userId }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("Phone number added successfully!");
        setPhoneNumber("");
        setTimeout(() => {
          onSuccess();
        }, 1000);
      } else {
        setError(data.error || "Failed to add phone number");
      }
    } catch (err: any) {
      setError(err.message || "Failed to add phone number");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="07034494055"
          className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-white/20 bg-white/60 dark:bg-white/10 text-gray-900 dark:text-white"
          required
        />
        <p className="text-xs text-gray-500 dark:text-white/40 mt-1">
          Enter your Nigerian mobile number (e.g., 07034494055)
        </p>
      </div>
      {error && (
        <div className="p-3 bg-red-100/80 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-xl">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-100/80 dark:bg-green-900/30 border border-green-300 dark:border-green-800 rounded-xl">
          <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
        </div>
      )}
      <button
        type="submit"
        disabled={loading || !phoneNumber}
        className="w-full bg-secondary hover:bg-secondary/90 text-primary font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Adding..." : "Add Phone Number"}
      </button>
    </form>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [walletAddresses, setWalletAddresses] = useState<Record<string, string>>({});
  
  // Invoice settings state
  const [invoiceType, setInvoiceType] = useState<"personal" | "business">("personal");
  const [savingInvoiceSettings, setSavingInvoiceSettings] = useState(false);
  const [invoiceSettingsSuccess, setInvoiceSettingsSuccess] = useState("");
  const [invoiceSettingsError, setInvoiceSettingsError] = useState("");
  
  // Seed phrase state
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState<string>("");
  const [authenticating, setAuthenticating] = useState(false);
  const [seedError, setSeedError] = useState("");
  const [seedCopied, setSeedCopied] = useState(false);

  useEffect(() => {
    const currentUser = getUserFromStorage();
    if (!currentUser) {
      router.push("/auth");
      return;
    }
    setUser(currentUser);
    fetchUserProfile(currentUser.id);
  }, [router]);

  const fetchUserProfile = async (userId: string) => {
    try {
      const response = await fetch(`/api/user/profile?userId=${userId}`);
      const data = await response.json();
      
      if (data.success && data.profile) {
        setUserProfile(data.profile);
        if (data.profile.addresses) {
          setWalletAddresses(data.profile.addresses);
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewSeedPhrase = async () => {
    if (!user?.id) return;

    setAuthenticating(true);
    setSeedError("");
    setSeedPhrase("");

    try {
      // Step 1: Authenticate with passkey
      const authResult = await authenticateWithPasskey(user.id);
      if (!authResult.success) {
        setSeedError(authResult.error || "Passkey authentication failed");
        return;
      }

      // Step 2: Get encrypted seed
      const seedResponse = await fetch("/api/passkey/seed-phrase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          passkeyVerified: true,
        }),
      });

      const seedData = await seedResponse.json();
      if (!seedData.success || !seedData.encryptedSeed || !seedData.publicKey) {
        setSeedError("Failed to retrieve wallet data");
        return;
      }

      // Step 3: Decrypt seed phrase client-side
      const decryptedSeed = await decryptSeedPhrase(
        seedData.encryptedSeed,
        seedData.publicKey
      );

      setSeedPhrase(decryptedSeed);
      setShowSeedPhrase(true);
    } catch (error: any) {
      console.error("Error viewing seed phrase:", error);
      setSeedError(error.message || "Failed to view seed phrase");
    } finally {
      setAuthenticating(false);
    }
  };

  const copySeedPhrase = () => {
    if (seedPhrase) {
      navigator.clipboard.writeText(seedPhrase);
      setSeedCopied(true);
      setTimeout(() => setSeedCopied(false), 2000);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    // You can add a toast notification here
  };

  const handleSaveInvoiceSettings = async () => {
    if (!user?.id) return;

    setSavingInvoiceSettings(true);
    setInvoiceSettingsError("");
    setInvoiceSettingsSuccess("");

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          invoice_type: invoiceType,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setInvoiceSettingsSuccess("Invoice settings saved successfully!");
        setTimeout(() => {
          setInvoiceSettingsSuccess("");
        }, 3000);
        // Refresh profile to get updated data
        fetchUserProfile(user.id);
      } else {
        setInvoiceSettingsError(data.error || "Failed to save invoice settings");
        setTimeout(() => {
          setInvoiceSettingsError("");
        }, 5000);
      }
    } catch (error: any) {
      console.error("Error saving invoice settings:", error);
      setInvoiceSettingsError(error.message || "Failed to save invoice settings");
      setTimeout(() => {
        setInvoiceSettingsError("");
      }, 5000);
    } finally {
      setSavingInvoiceSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      {/* Header Background */}
      <div className="absolute top-0 left-0 w-full h-[200px] bg-primary rounded-b-[3rem] z-0 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6 text-secondary dark:text-white">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-secondary/10 dark:hover:bg-white/10 rounded-lg transition"
            >
              <span className="material-icons-outlined text-secondary dark:text-white">arrow_back</span>
            </button>
            <h1 className="text-2xl font-bold text-secondary dark:text-white">Settings</h1>
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            {/* Profile Section */}
            <div className="bg-white/40 dark:bg-white/20 backdrop-blur-md rounded-3xl p-6 border border-white/30 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-icons-outlined">person</span>
                Profile
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-white/60">Display Name</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">
                      {userProfile?.displayName || "Not set"}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push("/profile")}
                    className="bg-secondary hover:bg-secondary/90 text-primary font-semibold py-2 px-4 rounded-xl transition-colors"
                  >
                    Edit Profile
                  </button>
                </div>
                <div className="pt-4 border-t border-gray-200 dark:border-white/10">
                  <p className="text-sm text-gray-600 dark:text-white/60 mb-1">Email</p>
                  <p className="text-base text-gray-900 dark:text-white">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Phone Number & NGN Account Section */}
            <div className="bg-white/40 dark:bg-white/20 backdrop-blur-md rounded-3xl p-6 border border-white/30 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-icons-outlined">phone</span>
                Phone Number & NGN Account
              </h2>
              <div className="space-y-4">
                {userProfile?.mobileNumber ? (
                  <>
                    <div className="pt-4 border-t border-gray-200 dark:border-white/10">
                      <p className="text-sm text-gray-600 dark:text-white/60 mb-1">Phone Number</p>
                      <p className="text-base text-gray-900 dark:text-white">{userProfile.mobileNumber}</p>
                    </div>
                    {userProfile.flutterwaveAccountNumber && (
                      <>
                        <div className="pt-4 border-t border-gray-200 dark:border-white/10">
                          <p className="text-sm text-gray-600 dark:text-white/60 mb-1">NGN Account Number</p>
                          <p className="text-base font-mono text-gray-900 dark:text-white">{userProfile.flutterwaveAccountNumber}</p>
                          <p className="text-xs text-gray-500 dark:text-white/40 mt-1">{userProfile.flutterwaveBank}</p>
                        </div>
                        {!userProfile.flutterwaveIsPermanent && (
                          <div className="p-3 bg-yellow-100/80 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-800 rounded-xl">
                            <p className="text-xs text-yellow-800 dark:text-yellow-300 mb-2">
                              ⚠️ Temporary account (Tier 1). Verify your BVN to get a permanent account and upgrade to Tier 2 with higher limits.
                            </p>
                            <button
                              onClick={() => router.push("/kyc/verify-bvn")}
                              className="text-xs bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-1.5 px-3 rounded-lg transition-colors"
                            >
                              Verify BVN Now
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-white/60">
                      Add your phone number to create your NGN wallet account.
                    </p>
                    <AddPhoneNumberForm onSuccess={() => fetchUserProfile(user.id)} userId={user.id} />
                  </div>
                )}
              </div>
            </div>

            {/* KYC Section */}
            <div className="bg-white/40 dark:bg-white/20 backdrop-blur-md rounded-3xl p-6 border border-white/30 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-icons-outlined">verified_user</span>
                KYC Verification & Limits
              </h2>
              <div className="space-y-4">
                {(() => {
                  const hasAccount = userProfile?.mobileNumber && userProfile?.flutterwaveAccountNumber;
                  const currentTier = hasAccount ? ((userProfile?.flutterwaveKYCTier || 1) as KYCTier) : (1 as KYCTier);
                  const tierInfo = getKYCTierInfo(currentTier);
                  const upgradeInfo = hasAccount ? canUpgradeTier(currentTier, !!userProfile?.flutterwaveIsPermanent) : { canUpgrade: false, nextTier: KYC_TIERS[2] };
                  const allTiers = [1, 2, 3] as KYCTier[];
                    
                    return (
                      <>
                        {!hasAccount && (
                          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl mb-4">
                            <p className="text-sm text-yellow-800 dark:text-yellow-300">
                              Add your phone number above to create your NGN account. Once created, you'll start at Tier 1.
                            </p>
                          </div>
                        )}

                        {/* Current Tier Card */}
                        {hasAccount && (
                          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border-2 border-blue-300 dark:border-blue-700 mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                Your Current Tier: {tierInfo.name}
                              </h3>
                              <span className="px-3 py-1 bg-blue-500 dark:bg-blue-600 text-white rounded-full text-xs font-bold">
                                Tier {currentTier} ✓
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-white/70 mb-4">
                              {tierInfo.description}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                              <div className="p-3 bg-white/80 dark:bg-white/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <p className="text-xs text-gray-600 dark:text-white/60 mb-1">Daily Limit</p>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                  {formatCurrency(tierInfo.dailyLimit)}
                                </p>
                              </div>
                              <div className="p-3 bg-white/80 dark:bg-white/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <p className="text-xs text-gray-600 dark:text-white/60 mb-1">Monthly Limit</p>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                  {formatCurrency(tierInfo.monthlyLimit)}
                                </p>
                              </div>
                              <div className="p-3 bg-white/80 dark:bg-white/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <p className="text-xs text-gray-600 dark:text-white/60 mb-1">Single Transaction</p>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                  {formatCurrency(tierInfo.singleTransactionLimit)}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* All Tiers Comparison */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                            Available Tiers & Upgrade Options
                          </h4>
                          {allTiers.map((tier) => {
                            const info = KYC_TIERS[tier];
                            const isCurrentTier = tier === currentTier;
                            const isNextTier = tier === currentTier + 1;
                            const isLocked = tier > currentTier + 1;
                            
                            return (
                              <div
                                key={tier}
                                className={`p-4 rounded-xl border-2 ${
                                  isCurrentTier
                                    ? "bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600"
                                    : isNextTier
                                    ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
                                    : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
                                }`}
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h5 className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {info.name}
                                      </h5>
                                      {isCurrentTier && (
                                        <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full font-medium">
                                          Current
                                        </span>
                                      )}
                                      {isNextTier && (
                                        <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full font-medium">
                                          Available
                                        </span>
                                      )}
                                      {isLocked && (
                                        <span className="px-2 py-0.5 bg-gray-400 text-white text-xs rounded-full font-medium">
                                          Locked
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-white/70 mb-3">
                                      {info.description}
                                    </p>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                      <div>
                                        <p className="text-gray-500 dark:text-white/50">Daily</p>
                                        <p className="font-semibold text-gray-900 dark:text-white">
                                          {formatCurrency(info.dailyLimit)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-gray-500 dark:text-white/50">Monthly</p>
                                        <p className="font-semibold text-gray-900 dark:text-white">
                                          {formatCurrency(info.monthlyLimit)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-gray-500 dark:text-white/50">Single TX</p>
                                        <p className="font-semibold text-gray-900 dark:text-white">
                                          {formatCurrency(info.singleTransactionLimit)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Upgrade Button Logic */}
                                {isNextTier && hasAccount && (
                                  <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                                    {currentTier === 1 ? (
                                      <button
                                        onClick={() => router.push("/kyc/verify-bvn")}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                                      >
                                        <span className="material-icons-outlined text-sm">arrow_upward</span>
                                        Verify BVN to Upgrade to Tier 2
                                      </button>
                                    ) : currentTier === 2 ? (
                                      <button
                                        onClick={() => router.push("/kyc/upgrade-tier-3")}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                                      >
                                        <span className="material-icons-outlined text-sm">arrow_upward</span>
                                        Upgrade to Tier 3 (Enhanced KYC)
                                      </button>
                                    ) : null}
                                  </div>
                                )}
                                {isNextTier && !hasAccount && (
                                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                    <p className="text-xs text-gray-500 dark:text-white/50 text-center">
                                      Add phone number to unlock
                                    </p>
                                  </div>
                                )}
                                {isLocked && (
                                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                    <p className="text-xs text-gray-500 dark:text-white/50 text-center">
                                      Complete Tier {tier - 1} first to unlock
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Upgrade Benefits Summary */}
                        {hasAccount && upgradeInfo.canUpgrade && upgradeInfo.nextTier && (
                          <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-300 dark:border-green-700 rounded-xl">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="material-icons-outlined text-green-600 dark:text-green-400">trending_up</span>
                              <h4 className="text-sm font-bold text-green-900 dark:text-green-300">
                                Upgrade Benefits
                              </h4>
                            </div>
                            <div className="space-y-2 text-xs text-green-800 dark:text-green-400">
                              <p className="font-semibold">Upgrade to {upgradeInfo.nextTier.name} and get:</p>
                              <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>
                                  <strong>{(upgradeInfo.nextTier.dailyLimit / tierInfo.dailyLimit).toFixed(1)}x</strong> higher daily limit
                                  ({formatCurrency(tierInfo.dailyLimit)} → {formatCurrency(upgradeInfo.nextTier.dailyLimit)})
                                </li>
                                <li>
                                  <strong>{(upgradeInfo.nextTier.monthlyLimit / tierInfo.monthlyLimit).toFixed(1)}x</strong> higher monthly limit
                                  ({formatCurrency(tierInfo.monthlyLimit)} → {formatCurrency(upgradeInfo.nextTier.monthlyLimit)})
                                </li>
                                <li>
                                  <strong>{(upgradeInfo.nextTier.singleTransactionLimit / tierInfo.singleTransactionLimit).toFixed(1)}x</strong> higher single transaction limit
                                  ({formatCurrency(tierInfo.singleTransactionLimit)} → {formatCurrency(upgradeInfo.nextTier.singleTransactionLimit)})
                                </li>
                              </ul>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

            {/* Security Section - Seed Phrase */}
            <div className="bg-white/40 dark:bg-white/20 backdrop-blur-md rounded-3xl p-6 border border-white/30 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-icons-outlined">security</span>
                Security
              </h2>
              
              {!showSeedPhrase ? (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-100/80 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-800 rounded-xl">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium mb-2">
                      ⚠️ Important Security Warning
                    </p>
                    <ul className="text-xs text-yellow-700 dark:text-yellow-400 space-y-1 list-disc list-inside">
                      <li>Never share your seed phrase with anyone</li>
                      <li>Store it in a safe, offline location</li>
                      <li>Anyone with your seed phrase can access your wallet</li>
                      <li>We never store your seed phrase in plaintext</li>
                    </ul>
                  </div>
                  
                  {seedError && (
                    <div className="p-3 bg-red-100/80 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-xl">
                      <p className="text-sm text-red-700 dark:text-red-300">{seedError}</p>
                    </div>
                  )}

                  <button
                    onClick={handleViewSeedPhrase}
                    disabled={authenticating}
                    className="w-full bg-secondary hover:bg-secondary/90 text-primary font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {authenticating ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-icons-outlined">fingerprint</span>
                        <span>View Seed Phrase</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-red-100/80 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-xl">
                    <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                      ⚠️ Keep this seed phrase secret and secure!
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {seedPhrase.split(" ").map((word, index) => (
                      <div
                        key={index}
                        className="p-3 bg-white/60 dark:bg-secondary/30 rounded-xl border border-secondary/10 dark:border-white/10 text-center"
                      >
                        <span className="text-xs text-gray-500 dark:text-white/40 mr-1">
                          {index + 1}.
                        </span>
                        <span className="text-sm font-mono font-semibold text-gray-900 dark:text-white">
                          {word}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={copySeedPhrase}
                    className={`w-full font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 ${
                      seedCopied
                        ? "bg-accent-green hover:bg-accent-green/90 text-primary"
                        : "bg-secondary hover:bg-secondary/90 text-primary"
                    }`}
                  >
                    {seedCopied ? (
                      <>
                        <span className="material-icons-outlined">check</span>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <span className="material-icons-outlined">content_copy</span>
                        <span>Copy Seed Phrase</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setShowSeedPhrase(false);
                      setSeedPhrase("");
                    }}
                    className="w-full bg-white/40 hover:bg-white/60 text-gray-900 dark:text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                  >
                    Hide Seed Phrase
                  </button>
                </div>
              )}
            </div>

            {/* Wallet Addresses Section */}
            <div className="bg-white/40 dark:bg-white/20 backdrop-blur-md rounded-3xl p-6 border border-white/30 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-icons-outlined">account_balance_wallet</span>
                Wallet Addresses
              </h2>
              
              {Object.keys(walletAddresses).length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-white/60">
                  No wallet addresses found. Please set up a passkey to generate addresses.
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(walletAddresses).map(([chainId, address]) => {
                    const chain = SUPPORTED_CHAINS[chainId];
                    return (
                      <div
                        key={chainId}
                        className="p-4 bg-white/60 dark:bg-secondary/30 rounded-xl border border-secondary/10 dark:border-white/10"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getChainLogo(chainId) ? (
                              <Image
                                src={getChainLogo(chainId)}
                                alt={chain?.name || chainId}
                                width={20}
                                height={20}
                                className="rounded-full"
                                unoptimized
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : null}
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {chain?.name || chainId}
                            </span>
                            <span className="text-xs text-gray-600 dark:text-white/50">
                              ({chain?.nativeCurrency?.symbol || "N/A"})
                            </span>
                          </div>
                          <button
                            onClick={() => copyAddress(address)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition"
                            title="Copy address"
                          >
                            <span className="material-icons-outlined text-sm text-gray-700 dark:text-white">
                              content_copy
                            </span>
                          </button>
                        </div>
                        <p className="text-xs font-mono text-gray-700 dark:text-white/70 break-all">
                          {address}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Invoice Settings */}
            <div className="bg-white/40 dark:bg-white/20 backdrop-blur-md rounded-3xl p-6 border border-white/30 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-icons-outlined">receipt_long</span>
                Invoice Settings
              </h2>
              <div className="space-y-4">
                {/* Invoice Type Toggle */}
                <div>
                  <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
                    Invoice Type
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setInvoiceType("personal")}
                      className={`flex-1 py-2 px-4 rounded-xl font-semibold transition-colors ${
                        invoiceType === "personal"
                          ? "bg-primary text-secondary"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      Personal
                    </button>
                    <button
                      type="button"
                      onClick={() => setInvoiceType("business")}
                      className={`flex-1 py-2 px-4 rounded-xl font-semibold transition-colors ${
                        invoiceType === "business"
                          ? "bg-primary text-secondary"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      Business
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {invoiceType === "personal" 
                      ? "Invoices will show your personal name and email"
                      : "Invoices will show your business information and logo"}
                  </p>
                </div>

                {/* Success/Error Messages */}
                {invoiceSettingsSuccess && (
                  <div className="p-3 bg-green-100/80 dark:bg-green-900/30 border border-green-300 dark:border-green-800 rounded-xl">
                    <p className="text-sm text-green-700 dark:text-green-300">{invoiceSettingsSuccess}</p>
                  </div>
                )}
                {invoiceSettingsError && (
                  <div className="p-3 bg-red-100/80 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-xl">
                    <p className="text-sm text-red-700 dark:text-red-300">{invoiceSettingsError}</p>
                  </div>
                )}

                {/* Save Button */}
                <button
                  onClick={handleSaveInvoiceSettings}
                  disabled={savingInvoiceSettings}
                  className="w-full bg-secondary hover:bg-secondary/90 text-primary font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {savingInvoiceSettings ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-icons-outlined">save</span>
                      <span>Save Invoice Settings</span>
                    </>
                  )}
                </button>

                {/* Link to Profile for Business Details */}
                {invoiceType === "business" && (
                  <div className="p-3 bg-blue-100/80 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-800 rounded-xl">
                    <p className="text-xs text-blue-800 dark:text-blue-300 mb-2">
                      💡 To set up your business information (name, logo, address), visit your Profile page.
                    </p>
                    <button
                      onClick={() => router.push("/profile")}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      Go to Profile →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Other Settings */}
            <div className="bg-white/40 dark:bg-white/20 backdrop-blur-md rounded-3xl p-6 border border-white/30 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-icons-outlined">tune</span>
                Preferences
              </h2>
              <div className="space-y-4">
                <button
                  onClick={() => router.push("/receive")}
                  className="w-full flex items-center justify-between p-4 bg-white/60 dark:bg-secondary/30 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-white/80 dark:hover:bg-secondary/40 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-icons-outlined text-gray-900 dark:text-white">
                      qr_code
                    </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      Receive Crypto
                    </span>
                  </div>
                  <span className="material-icons-outlined text-gray-600 dark:text-white/40">
                    arrow_forward
                  </span>
                </button>

                <button
                  onClick={() => router.push("/send")}
                  className="w-full flex items-center justify-between p-4 bg-white/60 dark:bg-secondary/30 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-white/80 dark:hover:bg-secondary/40 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-icons-outlined text-gray-900 dark:text-white">
                      send
                    </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      Send Crypto
                    </span>
                  </div>
                  <span className="material-icons-outlined text-gray-600 dark:text-white/40">
                    arrow_forward
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

