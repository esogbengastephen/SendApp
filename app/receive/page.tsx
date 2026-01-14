"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getUserFromStorage, isUserLoggedIn } from "@/lib/session";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import { authenticateWithPasskey } from "@/lib/passkey";
import { decryptSeedPhrase } from "@/lib/wallet";
import { getChainLogo } from "@/lib/logos";
import dynamic from "next/dynamic";
import BottomNavigation from "@/components/BottomNavigation";

// Lazy load QRCode component to reduce initial bundle
const QRCodeSVG = dynamic(() => import("qrcode.react").then(mod => ({ default: mod.QRCodeSVG })), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center">Loading QR...</div>,
});

type ReceiveType = "ngn" | "crypto";

export default function ReceivePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [receiveType, setReceiveType] = useState<ReceiveType>("ngn");
  const [walletAddresses, setWalletAddresses] = useState<Record<string, string>>({});
  const [virtualAccount, setVirtualAccount] = useState<any>(null);
  const [selectedChain, setSelectedChain] = useState("base");
  const [copied, setCopied] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (user) {
      fetchWalletAddresses();
      fetchVirtualAccount();
    }
  }, [user]);

  const fetchVirtualAccount = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/user/virtual-account?userId=${user.id}`);
      const data = await response.json();
      if (data.success && data.data) {
        setVirtualAccount({
          accountNumber: data.data.accountNumber,
          bankName: data.data.bankName,
        });
      }
    } catch (error) {
      console.error("Error fetching virtual account:", error);
    }
  };

  const fetchWalletAddresses = async () => {
    if (!user || !user.id) {
      console.error("[Receive] No user or user.id available");
      setLoadingAddresses(false);
      return;
    }
    
    setLoadingAddresses(true);
    try {
      const response = await fetch(`/api/user/profile?userId=${user.id}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[Receive] Profile API error:", response.status, errorData);
        return;
      }
      
      const data = await response.json();
      
      if (data.success && data.profile) {
        console.log("[Receive] Fetched addresses:", {
          addresses: data.profile.addresses,
          keys: data.profile.addresses ? Object.keys(data.profile.addresses) : [],
          selectedChain,
          hasSelected: data.profile.addresses?.[selectedChain]
        });
        
        if (data.profile.addresses) {
          setWalletAddresses(data.profile.addresses);
          console.log("[Receive] State updated with addresses:", Object.keys(data.profile.addresses));
        }
        setHasPasskey(data.profile.hasPasskey || false);
      } else {
        console.error("[Receive] Profile API returned unsuccessful:", data);
      }
    } catch (error) {
      console.error("[Receive] Error fetching addresses:", error);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const currentAddress = walletAddresses[selectedChain] || "";
  const chainConfig = SUPPORTED_CHAINS[selectedChain];
  
  // Check if user has addresses but missing the selected chain
  const hasAnyAddress = Object.keys(walletAddresses).length > 0;
  const missingSelectedChain = hasAnyAddress && !currentAddress && hasPasskey;
  const availableChains = Object.keys(walletAddresses).filter(chain => walletAddresses[chain]);
  
  // Debug: Log when addresses or selected chain changes
  useEffect(() => {
    console.log("[Receive] Address state:", {
      selectedChain,
      currentAddress: currentAddress || "NONE",
      allAddresses: walletAddresses,
      addressKeys: Object.keys(walletAddresses),
      hasAddressForSelected: !!walletAddresses[selectedChain]
    });
  }, [selectedChain, walletAddresses, currentAddress]);

  const copyAddress = () => {
    if (currentAddress) {
      navigator.clipboard.writeText(currentAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (address: string) => {
    if (address.length <= 20) return address;
    return `${address.substring(0, 10)}...${address.substring(address.length - 8)}`;
  };

  const handleFixMissingAddresses = async () => {
    if (!user || !user.id) return;

    setRegenerating(true);
    setRegenerateError("");
    
    try {
      // Step 1: Authenticate with passkey
      console.log("[Receive] Starting passkey authentication...");
      const authResult = await authenticateWithPasskey(user.id);
      if (!authResult.success) {
        console.error("[Receive] Passkey auth failed:", authResult.error);
        setRegenerateError(
          `Passkey authentication failed: ${authResult.error || "Unknown error"}\n\nPlease ensure:\n- Your device supports passkeys\n- You complete the biometric/PIN prompt\n- You're using a secure connection (HTTPS or localhost)`
        );
        return;
      }
      console.log("[Receive] Passkey authentication successful");

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
        setRegenerateError("Failed to retrieve wallet data. Please try again.");
        return;
      }

      // Step 3: Decrypt seed phrase client-side
      const seedPhrase = await decryptSeedPhrase(seedData.encryptedSeed, seedData.publicKey);
      
      // Step 3.5: Generate addresses client-side (where we know it works)
      console.log("[Receive] Generating addresses client-side...");
      console.log("[Receive] Seed phrase words:", seedPhrase.split(" ").length);
      
      // Test if ethers is available before generating
      try {
        const ethersTest = await import("ethers");
        console.log("[Receive] Ethers imported successfully:", typeof ethersTest.ethers !== "undefined");
        if (typeof ethersTest.ethers === "undefined") {
          throw new Error("ethers library failed to import");
        }
      } catch (ethersError: any) {
        console.error("[Receive] Ethers import failed:", ethersError);
        setRegenerateError(`Failed to load ethers library: ${ethersError.message}. Please refresh the page and try again.`);
        return;
      }
      
      let walletData: { addresses: Record<string, string> } | undefined;
      try {
        const { generateWalletFromSeed } = await import("@/lib/wallet");
        console.log("[Receive] Calling generateWalletFromSeed...");
        walletData = generateWalletFromSeed(seedPhrase);
        console.log("[Receive] Generated addresses:", Object.keys(walletData.addresses));
        console.log("[Receive] Address details:", walletData.addresses);
        
        if (!walletData) {
          setRegenerateError("Failed to generate wallet data. Please try again.");
          return;
        }
        
        // Check if EVM addresses were generated
        const evmChains = ["ethereum", "base", "polygon", "monad"];
        const missingEVM = evmChains.filter(chain => !walletData!.addresses[chain]);
        if (missingEVM.length > 0) {
          console.error("[Receive] ❌ MISSING EVM ADDRESSES:", missingEVM);
          console.error("[Receive] Available addresses:", Object.keys(walletData.addresses));
          setRegenerateError(`Failed to generate addresses for: ${missingEVM.join(", ")}. Check browser console (F12) for detailed error messages.`);
          return;
        }
        
        console.log("[Receive] ✅ All addresses generated successfully!");
      } catch (error: any) {
        console.error("[Receive] ❌ Error generating wallet:", error);
        console.error("[Receive] Error name:", error?.name);
        console.error("[Receive] Error message:", error?.message);
        console.error("[Receive] Error stack:", error?.stack);
        setRegenerateError(`Failed to generate wallet addresses: ${error.message || "Unknown error"}. Check browser console (F12) for details.`);
        return;
      }
      
      // Step 4: Send generated addresses to server (more reliable than server-side generation)
      const fixResponse = await fetch("/api/wallet/fix-missing-addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          addresses: walletData.addresses, // Send pre-generated addresses
        }),
      });

      const fixData = await fixResponse.json();
      if (!fixData.success) {
        setRegenerateError(fixData.error || "Failed to fix addresses. Please try again.");
        return;
      }

      // Step 4: Clear error and show success
      setRegenerateError(""); // Clear any previous errors
      
      // Show success message with details
      const addedChains = fixData.added || [];
      const totalChains = fixData.totalChains || Object.keys(fixData.addresses || {}).length;
      const successMsg = `Successfully fixed wallet addresses!\n\nAdded: ${addedChains.length > 0 ? addedChains.map((c: string) => SUPPORTED_CHAINS[c]?.name || c).join(", ") : "all missing chains"}\nTotal chains: ${totalChains}`;
      alert(successMsg);
      
      // Update addresses directly from response
      if (fixData.addresses) {
        console.log("[Receive] Updating addresses from fix response:", Object.keys(fixData.addresses));
        setWalletAddresses(fixData.addresses);
      }
      
      // Also refresh from API to ensure consistency
      console.log("[Receive] Refreshing addresses from API after fix...");
      await fetchWalletAddresses();
      
      // Force re-render by updating selected chain if it was missing
      if (!walletAddresses[selectedChain] && fixData.addresses?.[selectedChain]) {
        console.log("[Receive] Selected chain now has address, forcing update");
        const currentChain = selectedChain;
        setSelectedChain(""); // Clear
        setTimeout(() => setSelectedChain(currentChain), 100); // Restore
      }
    } catch (error: any) {
      console.error("[Receive] Error fixing addresses:", error);
      setRegenerateError(error.message || "Failed to fix addresses. Please try again.");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark relative">
      {/* Header Background */}
      <div className="absolute top-0 left-0 w-full h-[200px] bg-primary rounded-b-[3rem] z-0 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute top-20 -left-10 w-48 h-48 bg-white opacity-10 rounded-full blur-2xl"></div>
      </div>

      <div className="relative z-10 p-4">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6 text-secondary">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-secondary/10 rounded-lg transition"
            >
              <span className="material-icons-outlined text-secondary">arrow_back</span>
            </button>
            <h1 className="text-2xl font-bold text-secondary">Receive</h1>
          </div>
          
          {/* Main Card */}
          <div className="bg-white/40 dark:bg-white/20 backdrop-blur-md rounded-3xl p-6 border border-white/30 shadow-sm">
            {/* Type Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                Receive Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setReceiveType("ngn")}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    receiveType === "ngn"
                      ? "bg-primary border-primary text-secondary dark:text-white shadow-md"
                      : "bg-light-blue/50 dark:bg-secondary/40 border-primary/30 dark:border-white/30 text-gray-900 dark:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2 justify-center">
                    <span className="material-icons-outlined">account_balance</span>
                    <span className="font-semibold">NGN</span>
                  </div>
                </button>
                <button
                  onClick={() => setReceiveType("crypto")}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    receiveType === "crypto"
                      ? "bg-primary border-primary text-secondary dark:text-white shadow-md"
                      : "bg-light-blue/50 dark:bg-secondary/40 border-primary/30 dark:border-white/30 text-gray-900 dark:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2 justify-center">
                    <span className="material-icons-outlined">currency_bitcoin</span>
                    <span className="font-semibold">Crypto</span>
                  </div>
                </button>
              </div>
            </div>

            {receiveType === "crypto" ? (
              <>
                {/* Chain selector */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-900 dark:text-white">
                      Select Chain
                    </label>
                    <button
                      onClick={() => {
                        console.log("[Receive] Manual refresh triggered");
                        fetchWalletAddresses();
                      }}
                      className="text-xs text-background-dark dark:text-white hover:text-background-dark dark:hover:text-white/90 flex items-center gap-1 font-semibold"
                      title="Refresh addresses"
                    >
                      <span className="material-icons-outlined text-sm">refresh</span>
                      <span>Refresh</span>
                    </button>
                  </div>
                  {/* Custom Dropdown with Logos */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full p-3 border border-primary/30 dark:border-white/20 rounded-xl bg-white/60 dark:bg-secondary/30 backdrop-blur-sm text-background-dark dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {getChainLogo(selectedChain) ? (
                          <Image
                            src={getChainLogo(selectedChain)}
                            alt={chainConfig?.name || selectedChain}
                            width={24}
                            height={24}
                            className="rounded-full"
                            unoptimized
                            onError={(e) => {
                              // Fallback if image fails to load
                              console.error(`Failed to load logo for ${selectedChain}`);
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center">
                                <span className="text-xs text-background-dark dark:text-white font-bold">{(chainConfig?.name || selectedChain).charAt(0)}</span>
                          </div>
                        )}
                        <span className="text-background-dark dark:text-white font-bold">{chainConfig?.name || selectedChain}</span>
                      </div>
                      <span className="material-icons-outlined text-sm text-background-dark dark:text-white">
                        {isDropdownOpen ? "expand_less" : "expand_more"}
                      </span>
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute z-50 w-full mt-2 bg-light-blue dark:bg-background-dark/95 backdrop-blur-md rounded-xl border border-primary/30 dark:border-primary/50 shadow-lg max-h-64 overflow-y-auto">
                        {Object.entries(SUPPORTED_CHAINS).map(([chainId, chain]) => (
                          <button
                            key={chainId}
                            type="button"
                            onClick={() => {
                              setSelectedChain(chainId);
                              setIsDropdownOpen(false);
                              console.log("[Receive] Chain changed to:", chainId);
                            }}
                            className={`w-full p-3 flex items-center gap-3 transition-colors ${
                              selectedChain === chainId 
                                ? "bg-primary/20 dark:bg-primary/30 hover:bg-primary/30 dark:hover:bg-primary/40" 
                                : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
                            }`}
                          >
                            {getChainLogo(chainId) ? (
                              <Image
                                src={getChainLogo(chainId)}
                                alt={chain.name}
                                width={24}
                                height={24}
                                className="rounded-full"
                                unoptimized
                                onError={(e) => {
                                  // Fallback if image fails to load
                                  console.error(`Failed to load logo for ${chainId}`);
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center">
                                <span className="text-xs text-background-dark dark:text-white font-bold">{chain.name.charAt(0)}</span>
                              </div>
                            )}
                            <span className={`font-bold ${
                              selectedChain === chainId 
                                ? "text-background-dark dark:text-white" 
                                : "text-background-dark dark:text-white"
                            }`}>{chain.name}</span>
                            {selectedChain === chainId && (
                              <span className="material-icons-outlined text-primary dark:text-primary ml-auto text-sm">
                                check
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {Object.keys(walletAddresses).length > 0 && (
                    <p className="text-xs text-background-dark dark:text-white mt-1 font-bold">
                      Available: {Object.keys(walletAddresses).map(c => SUPPORTED_CHAINS[c]?.name || c).join(", ")}
                    </p>
                  )}
                </div>

                {/* Address display */}
                {loadingAddresses ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-background-dark/70 dark:text-white/70">Loading wallet addresses...</p>
                  </div>
                ) : !hasPasskey ? (
                  <div className="text-center py-8">
                    <span className="material-icons-outlined text-6xl text-background-dark/30 dark:text-white/30 mb-4">fingerprint</span>
                    <p className="text-gray-900 dark:text-white font-medium mb-2">
                      Passkey Not Set Up
                    </p>
                    <p className="text-sm text-gray-900 dark:text-white/80 mb-4">
                      You need to set up a passkey to generate wallet addresses
                    </p>
                    <button
                      onClick={() => router.push("/passkey-setup")}
                      className="bg-secondary hover:bg-secondary/90 text-gray-900 dark:text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 mx-auto"
                    >
                      <span className="material-icons-outlined">fingerprint</span>
                      <span>Set Up Passkey</span>
                    </button>
                  </div>
                ) : currentAddress ? (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                    Your {chainConfig?.name} Address
                  </label>
                  <div className="p-4 bg-white/60 dark:bg-secondary/30 backdrop-blur-sm rounded-xl break-all border border-primary/20 dark:border-white/10">
                    <p className="text-sm font-mono text-gray-900 dark:text-white" key={`addr-${selectedChain}-${currentAddress}`}>
                      {currentAddress}
                    </p>
                    {process.env.NODE_ENV === "development" && (
                      <p className="text-xs text-background-dark/50 dark:text-white/40 mt-2">
                        Debug: Chain={selectedChain}, Has={!!walletAddresses[selectedChain]}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={copyAddress}
                    className={`w-full mt-3 ${
                      copied 
                        ? "bg-accent-green hover:bg-accent-green/90" 
                        : "bg-secondary hover:bg-secondary/90"
                    } text-gray-900 dark:text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg`}
                  >
                    {copied ? (
                      <>
                        <span className="material-icons-outlined">check</span>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <span className="material-icons-outlined">content_copy</span>
                        <span>Copy Address</span>
                      </>
                    )}
                  </button>
                </div>

                {/* QR Code */}
                <div className="mt-6 p-8 bg-white/60 dark:bg-secondary/30 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center border border-primary/20 dark:border-white/10">
                  <div className="w-48 h-48 bg-white dark:bg-white rounded-xl flex items-center justify-center mb-4 border border-primary/20 dark:border-white/10 p-4">
                    {currentAddress ? (
                      <QRCodeSVG
                        value={currentAddress}
                        size={192}
                        level="H"
                        includeMargin={true}
                        fgColor="#1a1a1a"
                        bgColor="#ffffff"
                      />
                    ) : (
                      <span className="material-icons-outlined text-6xl text-background-dark/50 dark:text-white/40">qr_code</span>
                    )}
                  </div>
                  <p className="text-sm text-background-dark/70 dark:text-white/70 text-center font-medium">
                    QR Code for {chainConfig?.name} address
                  </p>
                  <p className="text-xs text-background-dark/60 dark:text-white/50 text-center mt-2 font-mono">
                    {formatAddress(currentAddress)}
                  </p>
                </div>

                {/* Network info */}
                <div className="mt-6 p-4 bg-primary/30 backdrop-blur-sm border border-primary/50 rounded-xl">
                  <p className="text-xs text-gray-900 dark:text-white font-medium">
                    <strong>Network:</strong> {chainConfig?.name}
                  </p>
                  <p className="text-xs text-gray-900 dark:text-white mt-1">
                    <strong>Symbol:</strong> {chainConfig?.nativeCurrency?.symbol || "N/A"}
                  </p>
                  <p className="text-xs text-background-dark dark:text-white mt-2">
                    Make sure you're sending to the correct network. Sending to the wrong network may result in loss of funds.
                  </p>
                </div>
              </>
                ) : missingSelectedChain ? (
                  <div className="text-center py-8">
                    <span className="material-icons-outlined text-6xl text-background-dark/30 dark:text-white/30 mb-4">account_balance_wallet</span>
                    <p className="text-gray-900 dark:text-white font-medium mb-2">
                      No wallet address found for {chainConfig?.name || "this chain"}
                    </p>
                    {availableChains.length > 0 && (
                      <p className="text-sm text-gray-900 dark:text-white/80 mb-2 font-medium">
                        Available chains: {availableChains.map(c => SUPPORTED_CHAINS[c]?.name || c).join(", ")}
                      </p>
                    )}
                    <p className="text-xs text-background-dark/80 dark:text-white/70 mt-4 mb-4">
                      This chain address wasn't generated during wallet setup.
                    </p>
                    
                    {regenerateError && (
                      <div className="mb-4 p-3 bg-red-100/80 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-xl backdrop-blur-sm">
                        <p className="text-sm text-red-700 dark:text-red-300 font-medium whitespace-pre-line">
                          {regenerateError}
                        </p>
                      </div>
                    )}
                    
                    <button
                      onClick={handleFixMissingAddresses}
                      disabled={regenerating}
                      className="bg-secondary hover:bg-secondary/90 text-gray-900 dark:text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
                    >
                      {regenerating ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                          <span>Fixing addresses...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-icons-outlined">refresh</span>
                          <span>Fix Missing Addresses</span>
                        </>
                      )}
                    </button>
                    <p className="text-xs text-gray-900 dark:text-white/80 mt-2">
                      Or try selecting: {availableChains.map(c => SUPPORTED_CHAINS[c]?.name || c).join(", ") || "another chain"}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <span className="material-icons-outlined text-6xl text-background-dark/30 dark:text-white/30 mb-4">account_balance_wallet</span>
                    <p className="text-gray-900 dark:text-white font-medium">
                      No wallet address found for {chainConfig?.name || "this chain"}
                    </p>
                    <p className="text-sm text-gray-900 dark:text-white/80 mt-2">
                      Please set up your passkey to generate wallet addresses
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* NGN Virtual Account Display */}
                {virtualAccount ? (
                  <>
                    <div className="mb-6">
                      <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                        Your Virtual Account
                      </label>
                      <div className="p-4 bg-white/60 dark:bg-secondary/30 backdrop-blur-sm rounded-xl border border-primary/20 dark:border-white/10">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-xs text-gray-900 dark:text-white/80 mb-1 font-medium">Account Number</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
                              {virtualAccount.accountNumber}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(virtualAccount.accountNumber);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }}
                            className={`p-2 rounded-lg transition-colors ${
                              copied ? "bg-accent-green" : "bg-primary/40 hover:bg-primary/60 border border-primary/50"
                            }`}
                          >
                            <span className="material-icons-outlined text-secondary">
                              {copied ? "check" : "content_copy"}
                            </span>
                          </button>
                        </div>
                        <div className="pt-3 border-t border-primary/20 dark:border-white/10">
                          <p className="text-xs text-gray-900 dark:text-white/80 mb-1 font-medium">Bank Name</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {virtualAccount.bankName || "Wema Bank"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* QR Code for NGN */}
                    {virtualAccount?.accountNumber && (
                      <div className="mt-6 p-8 bg-white/60 dark:bg-secondary/30 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center border border-primary/20 dark:border-white/10">
                        <div className="w-48 h-48 bg-white dark:bg-white rounded-xl flex items-center justify-center mb-4 border border-primary/20 dark:border-white/10 p-4">
                          <QRCodeSVG
                            value={`${virtualAccount.accountNumber}|${virtualAccount.bankName || "Wema Bank"}`}
                            size={192}
                            level="H"
                            includeMargin={true}
                            fgColor="#1a1a1a"
                            bgColor="#ffffff"
                          />
                        </div>
                        <p className="text-sm text-gray-900 dark:text-white/80 text-center font-medium">
                          QR Code for NGN payments
                        </p>
                        <p className="text-xs text-gray-900 dark:text-white/80 text-center mt-2 font-mono">
                          {virtualAccount.accountNumber}
                        </p>
                        <p className="text-xs text-gray-900 dark:text-white/80 text-center mt-1">
                          {virtualAccount.bankName || "Wema Bank"}
                        </p>
                      </div>
                    )}

                    {/* Info */}
                    <div className="mt-6 p-4 bg-primary/30 backdrop-blur-sm border border-primary/50 rounded-xl">
                      <p className="text-xs text-background-dark dark:text-white font-medium mb-2">
                        💡 How to receive NGN payments
                      </p>
                      <p className="text-xs text-background-dark/80 dark:text-white/70">
                        Share your account number above with anyone who wants to send you money. Payments will be automatically credited to your account.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <span className="material-icons-outlined text-6xl text-background-dark/30 dark:text-white/30 mb-4">account_balance</span>
                    <p className="text-gray-900 dark:text-white font-medium">
                      No virtual account found
                    </p>
                    <p className="text-sm text-gray-900 dark:text-white/80 mt-2">
                      Please contact support to set up your virtual account
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <BottomNavigation />
    </div>
  );
}
