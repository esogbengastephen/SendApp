"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserFromStorage, isUserLoggedIn } from "@/lib/session";
import { createPasskey, isPasskeySupported, isPlatformAuthenticatorAvailable } from "@/lib/passkey";
import { generateWalletFromSeed, generateSeedPhrase, encryptSeedPhrase } from "@/lib/wallet";

export default function PasskeySetupPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [settingUp, setSettingUp] = useState(false);
  const [error, setError] = useState("");
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [step, setStep] = useState<"intro" | "creating" | "success">("intro");
  const [hasExistingWallet, setHasExistingWallet] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  useEffect(() => {
    checkAuth();
    checkPasskeySupport();
    
    // Check for recovery mode in URL
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("recovery") === "true") {
        setIsRecoveryMode(true);
      }
    }
  }, []);

  const checkAuth = () => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
      return;
    }

    const currentUser = getUserFromStorage();
    if (!currentUser) {
      router.push("/auth");
      return;
    }

    setUser(currentUser);
    setLoading(false);

    // Check if user already has passkey
    checkExistingPasskey();
  };

  const checkExistingPasskey = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/user/check-passkey?userId=${user.id}`);
      const data = await response.json();

      if (data.success && data.hasPasskey) {
        // User already has passkey, redirect to dashboard
        router.push("/");
        return;
      }

      // Check if user has existing wallet (for recovery scenarios)
      if (data.success && data.hasWallet) {
        setHasExistingWallet(true);
        // Check if this is recovery mode (user came from recovery flow)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("recovery") === "true") {
          setIsRecoveryMode(true);
        }
      }
    } catch (error) {
      console.error("Error checking passkey:", error);
    }
  };

  const checkPasskeySupport = async () => {
    const supported = isPasskeySupported();
    const available = supported ? await isPlatformAuthenticatorAvailable() : false;
    setPasskeySupported(available);

    if (!supported) {
      setError("Passkeys are not supported in this browser. Please use a modern browser like Chrome, Safari, or Edge.");
    } else if (!available) {
      setError("Platform authenticator is not available. Please ensure you're using a device that supports biometric authentication.");
    }
  };

  const handleSetupPasskey = async () => {
    if (!user) return;

    // Show warning if user has existing wallet and not in recovery mode
    if (hasExistingWallet && !isRecoveryMode && !showWarning) {
      setShowWarning(true);
      setError("⚠️ WARNING: You already have a wallet. Creating a new passkey will generate a NEW wallet with NEW addresses. You will LOSE ACCESS to your old wallet and any funds in it. This action cannot be undone. Are you sure you want to continue?");
      return;
    }

    // If user confirmed the warning, clear it and proceed
    if (showWarning) {
      setShowWarning(false);
      setError("");
    }

    // If warning was shown and user clicked "Yes, Continue", proceed
    // (This check happens when showWarning is already true and user confirms)

    setSettingUp(true);
    setError("");
    setStep("creating");

    try {
      // Step 1: Generate wallet
      console.log("Generating wallet...");
      const seedPhrase = generateSeedPhrase();
      const walletData = generateWalletFromSeed(seedPhrase);
      
      // Verify all expected addresses were generated
      const expectedChains = ["bitcoin", "ethereum", "base", "polygon", "monad", "solana", "sui"];
      const missingChains = expectedChains.filter(chain => !walletData.addresses[chain]);
      
      if (missingChains.length > 0) {
        console.warn("Some chain addresses were not generated:", missingChains);
        // Continue anyway - some chains might fail but we should have at least some addresses
      }
      
      if (Object.keys(walletData.addresses).length === 0) {
        throw new Error("Failed to generate any wallet addresses. Please try again.");
      }
      
      console.log("Generated addresses for chains:", Object.keys(walletData.addresses));

      // Step 2: Create passkey
      console.log("Creating passkey...");
      const passkeyResult = await createPasskey(
        user.id,
        user.email,
        user.displayName || user.email
      );

      if (!passkeyResult.success || !passkeyResult.credential) {
        throw new Error(passkeyResult.error || "Failed to create passkey");
      }

      // Step 3: Encrypt seed phrase
      console.log("Encrypting seed phrase...");
      const encryptedSeed = await encryptSeedPhrase(
        seedPhrase,
        passkeyResult.credential.publicKey
      );

      // Step 4: Send to backend
      console.log("Saving to backend...");
      const response = await fetch("/api/passkey/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          credentialId: passkeyResult.credential.rawId,
          publicKey: passkeyResult.credential.publicKey,
          encryptedSeed,
          addresses: walletData.addresses,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to save passkey and wallet");
      }

      // Success!
      setStep("success");
      
      // Update user in storage
      const updatedUser = {
        ...user,
        hasPasskey: true,
        hasWallet: true,
        walletAddresses: walletData.addresses,
      };
      localStorage.setItem("user", JSON.stringify(updatedUser));

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push("/");
      }, 2000);

    } catch (err: any) {
      console.error("Error setting up passkey:", err);
      setError(err.message || "Failed to set up passkey. Please try again.");
      setStep("intro");
    } finally {
      setSettingUp(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
        {step === "intro" && (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-icons-outlined text-primary text-4xl">fingerprint</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Set Up Passkey
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Secure your account with a passkey. This will also create your multi-chain wallet automatically.
              </p>
            </div>

            {error && (
              <div className={`mb-6 p-4 border rounded-lg ${
                error.includes("WARNING") 
                  ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                  : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              }`}>
                <p className={`text-sm ${
                  error.includes("WARNING")
                    ? "text-yellow-800 dark:text-yellow-300"
                    : "text-red-600 dark:text-red-400"
                }`}>{error}</p>
                {error.includes("WARNING") && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={async () => {
                        setError("");
                        setShowWarning(true);
                        // Proceed with setup after user confirms
                        await handleSetupPasskey();
                      }}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                      Yes, Continue (I understand the risk)
                    </button>
                    <button
                      onClick={() => {
                        setError("");
                        setShowWarning(false);
                      }}
                      className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            {isRecoveryMode && hasExistingWallet && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  ℹ️ <strong>Recovery Mode:</strong> You're recovering your account. Your existing wallet addresses will be preserved for reference, but you'll get a new wallet with new addresses. The old seed phrase cannot be recovered without the old passkey.
                </p>
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="material-icons-outlined text-primary text-xl">security</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Enhanced Security</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Use biometric authentication or device PIN
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-icons-outlined text-primary text-xl">account_balance_wallet</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Multi-Chain Wallet</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Automatically creates wallets for Bitcoin, Ethereum, Solana, and more
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-icons-outlined text-primary text-xl">speed</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Quick Access</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Sign in instantly with your device
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleSetupPasskey}
              disabled={!passkeySupported || settingUp}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {settingUp ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Setting up...</span>
                </>
              ) : (
                <>
                  <span className="material-icons-outlined">fingerprint</span>
                  <span>Set Up Passkey</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                // Temporarily skip - but user will be prompted again next time
                if (confirm("You'll need a passkey to access your wallet. Skip for now?")) {
                  router.push("/");
                }
              }}
              className="w-full mt-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 text-sm py-2"
            >
              Skip for now (you'll be prompted again)
            </button>
          </>
        )}

        {step === "creating" && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              Creating Your Wallet
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Please follow the prompts on your device to set up your passkey...
            </p>
          </div>
        )}

        {step === "success" && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-icons-outlined text-green-600 dark:text-green-400 text-4xl">check_circle</span>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              Passkey Set Up Successfully!
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Your multi-chain wallet has been created. Redirecting to dashboard...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

