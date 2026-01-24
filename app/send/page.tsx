"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { getUserFromStorage, isUserLoggedIn } from "@/lib/session";
import { authenticateWithPasskey } from "@/lib/passkey";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import { getChainLogo, getTokenLogo } from "@/lib/logos";
import BottomNavigation from "@/components/BottomNavigation";
import { NIGERIAN_BANKS, isValidBankAccountNumber } from "@/lib/nigerian-banks";

interface NigerianBank {
  code: string;
  name: string;
}

type SendType = "ngn" | "crypto";
type NGNRecipientType = "user" | "bank";

function SendPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [sendType, setSendType] = useState<SendType>("ngn");
  const [ngnRecipientType, setNgnRecipientType] = useState<NGNRecipientType>("user");
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [walletAddresses, setWalletAddresses] = useState<Record<string, string>>({});
  const [walletBalances, setWalletBalances] = useState<Record<string, Record<string, { balance: string; usdValue: number; symbol: string; name: string; address: string }>>>({});
  const [virtualAccount, setVirtualAccount] = useState<any>(null);
  const [selectedChain, setSelectedChain] = useState("base");
  const [selectedToken, setSelectedToken] = useState<string>(""); // Token address
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authenticating, setAuthenticating] = useState(false);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [isChainDropdownOpen, setIsChainDropdownOpen] = useState(false);
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false);
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false);
  const [availableBanks, setAvailableBanks] = useState<NigerianBank[]>(NIGERIAN_BANKS);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState("");
  const [verifiedAccount, setVerifiedAccount] = useState<{ accountName: string; accountNumber: string; bankCode: string } | null>(null);
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const chainDropdownRef = useRef<HTMLDivElement>(null);
  const tokenDropdownRef = useRef<HTMLDivElement>(null);
  const bankDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chainDropdownRef.current && !chainDropdownRef.current.contains(event.target as Node)) {
        setIsChainDropdownOpen(false);
      }
      if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(event.target as Node)) {
        setIsTokenDropdownOpen(false);
      }
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(event.target as Node)) {
        setIsBankDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

    // Check for query parameters
    const chainParam = searchParams.get("chain");
    const tokenParam = searchParams.get("token");
    const typeParam = searchParams.get("type");

    if (chainParam && SUPPORTED_CHAINS[chainParam]) {
      setSelectedChain(chainParam);
    }
    if (tokenParam) {
      setSelectedToken(tokenParam);
    }
    if (typeParam === "crypto") {
      setSendType("crypto");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (user) {
      fetchWalletAddresses();
      fetchVirtualAccount();
      fetchBanksList();
    }
  }, [user]);

  const fetchBanksList = async () => {
    setLoadingBanks(true);
    try {
      // Fetch from our API endpoint which calls Flutterwave API
      const response = await fetch("/api/flutterwave/banks");
      const data = await response.json();
      
      if (data.success && data.data.banks) {
        setAvailableBanks(data.data.banks);
      } else {
        // Fallback to static list
        setAvailableBanks(NIGERIAN_BANKS);
      }
    } catch (error) {
      console.error("Error fetching banks list:", error);
      // Keep static list as fallback
      setAvailableBanks(NIGERIAN_BANKS);
    } finally {
      setLoadingBanks(false);
    }
  };

  // Fetch balances when crypto is selected
  useEffect(() => {
    if (user && sendType === "crypto") {
      fetchWalletBalances();
    }
  }, [sendType, user]);

  const fetchWalletAddresses = async () => {
    if (!user || !user.id) {
      console.error("[Send] No user or user.id available");
      return;
    }
    
    try {
      const response = await fetch(`/api/user/profile?userId=${user.id}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[Send] Profile API error:", response.status, errorData);
        return;
      }
      
      const data = await response.json();
      if (data.success && data.profile && data.profile.addresses) {
        setWalletAddresses(data.profile.addresses);
      } else {
        console.error("[Send] Profile API returned unsuccessful:", data);
      }
    } catch (error) {
      console.error("[Send] Error fetching addresses:", error);
    }
  };

  const fetchWalletBalances = async () => {
    if (!user || !user.id) return;
    
    setLoadingBalances(true);
    try {
      const response = await fetch(`/api/wallet/balances?userId=${user.id}`);
      const data = await response.json();

      if (data.success && data.balances) {
        setWalletBalances(data.balances || {});
        
        // Auto-select first chain with balance if current selection has no balance
        const currentBalance = data.balances[selectedChain];
        if (!currentBalance || parseFloat(currentBalance.balance) === 0) {
          // Find first chain with balance > 0
          const availableChain = Object.entries(data.balances).find(
            ([_, balance]: [string, any]) => balance && parseFloat(balance.balance) > 0
          );
          if (availableChain) {
            setSelectedChain(availableChain[0]);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching wallet balances:", error);
    } finally {
      setLoadingBalances(false);
    }
  };

  const fetchVirtualAccount = async () => {
    if (!user) return;
    
    try {
      // Fetch dashboard data to get balance and account info
      const dashboardResponse = await fetch(`/api/user/dashboard?userId=${user.id}`);
      const dashboardData = await dashboardResponse.json();
      
      if (dashboardData.success && dashboardData.data) {
        setVirtualAccount({
          accountNumber: dashboardData.data.user.accountNumber,
          bankName: dashboardData.data.user.bankName,
          balance: dashboardData.data.balance.ngn || 0,
        });
      } else {
        // Fallback to virtual account API
        const response = await fetch(`/api/user/virtual-account?userId=${user.id}`);
        const data = await response.json();
        if (data.success && data.data) {
          setVirtualAccount({
            accountNumber: data.data.accountNumber,
            bankName: data.data.bankName,
            balance: 0,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching virtual account:", error);
    }
  };

  const handleSend = async () => {
    if (!user || !recipient || !amount) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Validate inputs
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        setError("Please enter a valid amount");
        return;
      }

          if (sendType === "crypto") {
            // Validate balance
            const tokenInfo = selectedTokenInfo;
            if (!tokenInfo || typeof tokenInfo === "string" || parseFloat(tokenInfo.balance) < amountNum) {
              const balance = typeof tokenInfo === "string" ? "0" : (tokenInfo?.balance || "0");
              const symbol = typeof tokenInfo === "string" ? "" : (tokenInfo?.symbol || "");
              setError(`Insufficient balance. Available: ${balance} ${symbol}`);
              setLoading(false);
              return;
            }

        // Crypto send requires passkey authentication
        setAuthenticating(true);
        const authResult = await authenticateWithPasskey(user.id);
        if (!authResult.success) {
          setError("Passkey authentication failed. Please try again.");
          setLoading(false);
          setAuthenticating(false);
          return;
        }
        setAuthenticating(false);

        // TODO: Implement actual crypto transaction signing and sending
        alert(`Send ${amount} ${SUPPORTED_CHAINS[selectedChain]?.nativeCurrency?.symbol || ""} to ${recipient}\n\nTransaction functionality coming soon!`);
      } else {
        // NGN send - either to user (phone) or bank account
        if (ngnRecipientType === "user") {
          // Send to user - validate phone number format (Nigerian mobile)
          const cleanedPhone = recipient.replace(/\D/g, "");
          const isValidPhone = cleanedPhone.length >= 10 && cleanedPhone.length <= 13 && 
                              (cleanedPhone.startsWith("0") || cleanedPhone.startsWith("234")) &&
                              ["7", "8", "9"].includes(cleanedPhone.replace(/^(0|234)/, "").charAt(0));

          if (!isValidPhone) {
            setError("Please enter a valid Nigerian mobile number (e.g., 07034494055)");
            setLoading(false);
            return;
          }
        } else {
          // Send to bank account - validate account number and bank
          if (!isValidBankAccountNumber(recipient)) {
            setError("Please enter a valid 10-digit bank account number");
            setLoading(false);
            return;
          }

          if (!selectedBank) {
            setError("Please select a bank");
            setLoading(false);
            return;
          }
        }

        // Validate balance
        if (!virtualAccount || parseFloat(virtualAccount.balance?.toString() || "0") < amountNum) {
          setError(`Insufficient balance. Available: ₦${parseFloat(virtualAccount?.balance?.toString() || "0").toLocaleString()}`);
          setLoading(false);
          return;
        }

        // Call send-money API
        const sendResponse = await fetch("/api/flutterwave/send-money", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipientType: ngnRecipientType,
            recipientPhoneNumber: ngnRecipientType === "user" ? recipient : undefined,
            recipientAccountNumber: ngnRecipientType === "bank" ? recipient : undefined,
            recipientBankCode: ngnRecipientType === "bank" ? selectedBank : undefined,
            amount: amountNum,
              narration: ngnRecipientType === "user" 
              ? `Transfer to ${recipient}` 
              : `Transfer to ${availableBanks.find(b => b.code === selectedBank)?.name || "Bank"} account`,
          }),
        });

        const sendData = await sendResponse.json();

        if (!sendData.success) {
          setError(sendData.error || "Transfer failed. Please try again.");
          setLoading(false);
          return;
        }

        // Success - show message and redirect
        const recipientDisplay = ngnRecipientType === "user" 
          ? recipient 
          : `${availableBanks.find(b => b.code === selectedBank)?.name || "Bank"} - ${recipient}`;
        alert(`Successfully sent ₦${amountNum.toLocaleString()} to ${recipientDisplay}`);
        
        // Refresh balance
        await fetchVirtualAccount();
        
        // Clear form
        setRecipient("");
        setAmount("");
        setSelectedBank("");
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push("/");
        }, 1500);
      }
    } catch (err: any) {
      console.error("Error sending:", err);
      setError(err.message || "Failed to send. Please try again.");
    } finally {
      setLoading(false);
      setAuthenticating(false);
    }
  };

  const chainConfig = SUPPORTED_CHAINS[selectedChain];
  const userAddress = walletAddresses[selectedChain];
  
  // Get available chains with tokens that have balance > 0
  const availableChains = Object.entries(walletBalances)
    .filter(([_, tokens]) => {
      return Object.values(tokens).some(token => parseFloat(token.balance) > 0);
    })
    .map(([chainId]) => chainId);
  
  // Get available tokens for selected chain (with balance > 0)
  const availableTokens = selectedChain && walletBalances[selectedChain]
    ? Object.entries(walletBalances[selectedChain])
        .filter(([_, token]) => parseFloat(token.balance) > 0)
    : [];
  
  // Get selected token info
  const selectedTokenInfo = selectedChain && selectedToken && walletBalances[selectedChain]?.[selectedToken];
  
  // Auto-select first token if none selected but chain has tokens
  useEffect(() => {
    if (selectedChain && availableTokens.length > 0 && !selectedToken) {
      setSelectedToken(availableTokens[0][0]);
    }
  }, [selectedChain, availableTokens.length]);

  // Verify bank account when account number and bank are both provided
  useEffect(() => {
    // Skip if already verified for this exact account number and bank
    if (verifiedAccount && 
        verifiedAccount.accountNumber === recipient && 
        verifiedAccount.bankCode === selectedBank &&
        recipient.length === 10 &&
        selectedBank) {
      return;
    }

    if (ngnRecipientType === "bank" && recipient.length === 10 && selectedBank && !verifyingAccount) {
      const verifyAccount = async () => {
        setVerifyingAccount(true);
        setVerificationError(null);
        
        try {
          const response = await fetch("/api/flutterwave/verify-account", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              accountNumber: recipient,
              bankCode: selectedBank,
            }),
          });

          const data = await response.json();

          if (data.success && data.data && data.data.accountName) {
            setVerifiedAccount({
              accountName: data.data.accountName,
              accountNumber: data.data.accountNumber || recipient,
              bankCode: selectedBank,
            });
            setVerificationError(null);
          } else {
            // Show error message with helpful context
            let errorMsg = data.error || "Failed to verify account. Please check the account number and bank.";
            
            // Add helpful context for test mode
            if (data.isTestMode && selectedBank !== "044") {
              errorMsg = "Account verification in test mode only supports Access Bank. Please switch to production mode or use Access Bank for testing.";
            }
            
            setVerificationError(errorMsg);
            setVerifiedAccount(null);
            console.error("[Account Verification] Failed:", data);
          }
        } catch (error: any) {
          console.error("Error verifying account:", error);
          setVerificationError("Network error. Please try again.");
          setVerifiedAccount(null);
        } finally {
          setVerifyingAccount(false);
        }
      };

      // Debounce verification - wait 500ms after user stops typing
      const timeoutId = setTimeout(verifyAccount, 500);
      return () => clearTimeout(timeoutId);
    } else if (ngnRecipientType === "bank" && (recipient.length !== 10 || !selectedBank)) {
      // Reset verification if account number or bank changes
      setVerifiedAccount(null);
      setVerificationError(null);
    }
  }, [recipient, selectedBank, ngnRecipientType]);

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
            <h1 className="text-2xl font-bold text-secondary">Send</h1>
          </div>
          
          {/* Main Card */}
          <div className="bg-white/40 dark:bg-white/20 backdrop-blur-md rounded-3xl p-6 border border-white/30 shadow-sm">
            {/* Type Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-background-dark dark:text-white/80">
                Send Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSendType("ngn")}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    sendType === "ngn"
                      ? "bg-primary border-primary text-secondary dark:text-white shadow-md"
                      : "bg-light-blue/50 dark:bg-secondary/30 border-primary/30 dark:border-white/20 text-background-dark dark:text-white/80"
                  }`}
                >
                  <div className="flex items-center gap-2 justify-center">
                    <span className="material-icons-outlined">account_balance</span>
                    <span className="font-semibold">NGN</span>
                  </div>
                </button>
                <button
                  onClick={() => setSendType("crypto")}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    sendType === "crypto"
                      ? "bg-primary border-primary text-secondary dark:text-white shadow-md"
                      : "bg-light-blue/50 dark:bg-secondary/30 border-primary/30 dark:border-white/20 text-background-dark dark:text-white/80"
                  }`}
                >
                  <div className="flex items-center gap-2 justify-center">
                    <span className="material-icons-outlined">currency_bitcoin</span>
                    <span className="font-semibold">Crypto</span>
                  </div>
                </button>
              </div>
            </div>

            {sendType === "crypto" ? (
              <>
                {/* Chain selector - only show chains with balance > 0 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2 text-background-dark dark:text-white/80">
                    Select Chain {loadingBalances && <span className="text-xs">(Loading...)</span>}
                  </label>
                  {loadingBalances ? (
                    <div className="w-full p-3 border border-primary/30 dark:border-white/20 rounded-xl bg-white/60 dark:bg-secondary/30 backdrop-blur-sm flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                      <span className="ml-2 text-sm text-background-dark dark:text-white/80">Loading balances...</span>
                    </div>
                  ) : (
                    <>
                      {availableChains.length > 0 ? (
                        <>
                          {/* Chain selector with logo */}
                          <div className="relative mb-3" ref={chainDropdownRef}>
                            <button
                              type="button"
                              onClick={() => setIsChainDropdownOpen(!isChainDropdownOpen)}
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
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center">
                                    <span className="text-xs text-background-dark dark:text-white font-bold">{(chainConfig?.name || selectedChain).charAt(0)}</span>
                                  </div>
                                )}
                                <span className="text-background-dark dark:text-white font-bold">
                                  {chainConfig?.name || selectedChain} (${Object.values(walletBalances[selectedChain] || {}).reduce((sum, token) => sum + token.usdValue, 0).toFixed(2)})
                                </span>
                              </div>
                              <span className="material-icons-outlined text-sm text-background-dark dark:text-white">
                                {isChainDropdownOpen ? "expand_less" : "expand_more"}
                              </span>
                            </button>

                            {isChainDropdownOpen && (
                              <div className="absolute z-50 w-full mt-2 bg-light-blue dark:bg-background-dark/95 backdrop-blur-md rounded-xl border border-primary/30 dark:border-primary/50 shadow-lg max-h-64 overflow-y-auto">
                                {availableChains.map((chainId) => {
                                  const chain = SUPPORTED_CHAINS[chainId];
                                  const tokens = walletBalances[chainId] || {};
                                  const totalUSD = Object.values(tokens).reduce((sum, token) => sum + token.usdValue, 0);
                                  return (
                                    <button
                                      key={chainId}
                                      type="button"
                                      onClick={() => {
                                        setSelectedChain(chainId);
                                        setSelectedToken("");
                                        setIsChainDropdownOpen(false);
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
                                          alt={chain?.name || chainId}
                                          width={24}
                                          height={24}
                                          className="rounded-full"
                                          unoptimized
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center">
                                          <span className="text-xs text-background-dark dark:text-white font-bold">{(chain?.name || chainId).charAt(0)}</span>
                                        </div>
                                      )}
                                      <span className="font-bold text-background-dark dark:text-white">
                                        {chain?.name || chainId} (${totalUSD.toFixed(2)})
                                      </span>
                                      {selectedChain === chainId && (
                                        <span className="material-icons-outlined text-primary dark:text-primary ml-auto text-sm">
                                          check
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          
                          {/* Token selector with logo */}
                          {availableTokens.length > 0 && (
                            <div className="relative" ref={tokenDropdownRef}>
                              <button
                                type="button"
                                onClick={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
                                className="w-full p-3 border border-primary/30 dark:border-white/20 rounded-xl bg-white/60 dark:bg-secondary/30 backdrop-blur-sm text-background-dark dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 flex items-center justify-between"
                              >
                                <div className="flex items-center gap-3">
                                  {selectedTokenInfo && getTokenLogo(selectedTokenInfo.symbol) ? (
                                    <Image
                                      src={getTokenLogo(selectedTokenInfo.symbol)}
                                      alt={selectedTokenInfo.symbol}
                                      width={24}
                                      height={24}
                                      className="rounded-full"
                                      unoptimized
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  ) : selectedTokenInfo ? (
                                    <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center">
                                      <span className="text-xs text-background-dark dark:text-white font-bold">{selectedTokenInfo.symbol.charAt(0)}</span>
                                    </div>
                                  ) : null}
                                  <span className="text-background-dark dark:text-white font-bold">
                                    {selectedTokenInfo ? `${selectedTokenInfo.symbol} (${selectedTokenInfo.name}) - ${parseFloat(selectedTokenInfo.balance).toFixed(6)} ${selectedTokenInfo.usdValue > 0 ? `($${selectedTokenInfo.usdValue.toFixed(2)})` : '(Price unavailable)'}` : 'Select Token'}
                                  </span>
                                </div>
                                <span className="material-icons-outlined text-sm text-background-dark dark:text-white">
                                  {isTokenDropdownOpen ? "expand_less" : "expand_more"}
                                </span>
                              </button>

                              {isTokenDropdownOpen && (
                                <div className="absolute z-50 w-full mt-2 bg-light-blue dark:bg-background-dark/95 backdrop-blur-md rounded-xl border border-primary/30 dark:border-primary/50 shadow-lg max-h-64 overflow-y-auto">
                                  {availableTokens.map(([tokenAddress, token]) => (
                                    <button
                                      key={tokenAddress}
                                      type="button"
                                      onClick={() => {
                                        setSelectedToken(tokenAddress);
                                        setIsTokenDropdownOpen(false);
                                      }}
                                      className={`w-full p-3 flex items-center gap-3 transition-colors ${
                                        selectedToken === tokenAddress 
                                          ? "bg-primary/20 dark:bg-primary/30 hover:bg-primary/30 dark:hover:bg-primary/40" 
                                          : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
                                      }`}
                                    >
                                      {getTokenLogo(token.symbol) ? (
                                        <Image
                                          src={getTokenLogo(token.symbol)}
                                          alt={token.symbol}
                                          width={24}
                                          height={24}
                                          className="rounded-full"
                                          unoptimized
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center">
                                          <span className="text-xs text-background-dark dark:text-white font-bold">{token.symbol.charAt(0)}</span>
                                        </div>
                                      )}
                                      <div className="flex-1 text-left">
                                        <span className="font-bold text-background-dark dark:text-white block">
                                          {token.symbol} ({token.name})
                                        </span>
                                        <span className="text-xs text-background-dark/70 dark:text-white/70">
                                          {parseFloat(token.balance).toFixed(6)} {token.usdValue > 0 ? `($${token.usdValue.toFixed(2)})` : '(Price unavailable)'}
                                        </span>
                                      </div>
                                      {selectedToken === tokenAddress && (
                                        <span className="material-icons-outlined text-primary dark:text-primary ml-auto text-sm">
                                          check
                                        </span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {userAddress && selectedTokenInfo && (
                            <div className="mt-2 p-2 bg-primary/20 dark:bg-primary/10 border border-primary/30 dark:border-primary/20 rounded-lg">
                              <p className="text-xs text-background-dark/70 dark:text-white/60 font-mono mb-1">
                                Your {chainConfig?.name} address: {userAddress.substring(0, 10)}...{userAddress.substring(userAddress.length - 8)}
                              </p>
                              <p className="text-xs font-semibold text-background-dark dark:text-white">
                                Available: {parseFloat(selectedTokenInfo.balance).toFixed(6)} {selectedTokenInfo.symbol}
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-4 bg-yellow-100/80 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-800 rounded-xl backdrop-blur-sm">
                          <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium text-center">
                            No tokens available. Please receive tokens first.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Recipient address */}
                {availableChains.length > 0 && availableTokens.length > 0 && selectedTokenInfo && (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2 text-background-dark dark:text-white/80">
                        Recipient Wallet Address
                      </label>
                      <input
                        type="text"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        placeholder={chainConfig?.type === "EVM" ? "0x..." : chainConfig?.type === "SOLANA" ? "Solana address..." : "Address..."}
                        className="w-full p-3 border border-primary/30 dark:border-white/20 rounded-xl bg-white/60 dark:bg-secondary/30 backdrop-blur-sm text-background-dark dark:text-white font-mono placeholder:text-background-dark/50 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    {/* Amount */}
                    {selectedTokenInfo && (
                      <div className="mb-6">
                        <label className="block text-sm font-medium mb-2 text-background-dark dark:text-white/80">
                          Amount ({selectedTokenInfo.symbol})
                        </label>
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          step="0.00000001"
                          max={parseFloat(selectedTokenInfo.balance)}
                          className="w-full p-3 border border-primary/30 dark:border-white/20 rounded-xl bg-white/60 dark:bg-secondary/30 backdrop-blur-sm text-background-dark dark:text-white font-medium placeholder:text-background-dark/50 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <p className="text-xs text-background-dark/70 dark:text-white/60 mt-1">
                          Max: {parseFloat(selectedTokenInfo.balance).toFixed(6)} {selectedTokenInfo.symbol}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                {/* Recipient Type Selector */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2 text-background-dark dark:text-white/80">
                    Send To
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setNgnRecipientType("user");
                        setRecipient("");
                        setSelectedBank("");
                      }}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        ngnRecipientType === "user"
                          ? "bg-primary border-primary text-secondary dark:text-white shadow-md"
                          : "bg-light-blue/50 dark:bg-secondary/30 border-primary/30 dark:border-white/20 text-background-dark dark:text-white/80"
                      }`}
                    >
                      <div className="flex items-center gap-2 justify-center">
                        <span className="material-icons-outlined text-sm">person</span>
                        <span className="font-semibold text-sm">User</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNgnRecipientType("bank");
                        setRecipient("");
                        setSelectedBank("");
                        setBankSearchQuery("");
                        setVerifiedAccount(null);
                        setVerificationError(null);
                      }}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        ngnRecipientType === "bank"
                          ? "bg-primary border-primary text-secondary dark:text-white shadow-md"
                          : "bg-light-blue/50 dark:bg-secondary/30 border-primary/30 dark:border-white/20 text-background-dark dark:text-white/80"
                      }`}
                    >
                      <div className="flex items-center gap-2 justify-center">
                        <span className="material-icons-outlined text-sm">account_balance</span>
                        <span className="font-semibold text-sm">Bank</span>
                      </div>
                    </button>
                  </div>
                </div>

                {ngnRecipientType === "bank" && (
                  <>
                    {/* Searchable Bank Input */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2 text-background-dark dark:text-white/80">
                        Search Bank
                      </label>
                      <div className="relative" ref={bankDropdownRef}>
                        <input
                          type="text"
                          value={selectedBank ? (availableBanks.find(b => b.code === selectedBank)?.name || bankSearchQuery) : bankSearchQuery}
                          onChange={(e) => {
                            const value = e.target.value;
                            setBankSearchQuery(value);
                            setSelectedBank(""); // Clear selection when user types
                            setVerifiedAccount(null); // Reset verification
                            setIsBankDropdownOpen(true);
                            // Auto-select if exact match
                            const exactMatch = availableBanks.find(
                              b => b.name.toLowerCase() === value.toLowerCase()
                            );
                            if (exactMatch) {
                              setSelectedBank(exactMatch.code);
                              setBankSearchQuery(exactMatch.name);
                              setIsBankDropdownOpen(false);
                            }
                          }}
                          onFocus={() => {
                            if (!selectedBank) {
                              setIsBankDropdownOpen(true);
                            }
                          }}
                          placeholder="Type to search banks (e.g., OPay, Palmpay, GTB, Moniepoint)"
                          className="w-full p-3 border border-primary/30 dark:border-white/20 rounded-xl bg-white/60 dark:bg-secondary/30 backdrop-blur-sm text-background-dark dark:text-white font-medium placeholder:text-background-dark/50 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        {selectedBank && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBank("");
                              setBankSearchQuery("");
                              setVerifiedAccount(null);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                          >
                            <span className="material-icons-outlined text-sm text-background-dark dark:text-white">close</span>
                          </button>
                        )}

                        {/* Search Results Dropdown */}
                        {isBankDropdownOpen && (bankSearchQuery || !selectedBank) && (
                          <div className="absolute z-50 w-full mt-2 bg-light-blue dark:bg-background-dark/95 backdrop-blur-md rounded-xl border border-primary/30 dark:border-primary/50 shadow-lg max-h-64 overflow-y-auto">
                            {loadingBanks ? (
                              <div className="p-4 text-center">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto"></div>
                                <p className="text-xs text-background-dark/70 dark:text-white/60 mt-2">Loading banks...</p>
                              </div>
                            ) : (
                              <>
                                {availableBanks
                                  .filter(bank => 
                                    !bankSearchQuery || bank.name.toLowerCase().includes(bankSearchQuery.toLowerCase())
                                  )
                                  .slice(0, 20) // Limit to 20 results
                                  .map((bank) => (
                                    <button
                                      key={bank.code}
                                      type="button"
                                      onClick={() => {
                                        setSelectedBank(bank.code);
                                        setBankSearchQuery(bank.name);
                                        setIsBankDropdownOpen(false);
                                        setVerifiedAccount(null); // Reset verification when bank changes
                                        setVerificationError(null);
                                      }}
                                      className={`w-full p-3 text-left transition-colors ${
                                        selectedBank === bank.code 
                                          ? "bg-primary/20 dark:bg-primary/30 hover:bg-primary/30 dark:hover:bg-primary/40" 
                                          : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
                                      }`}
                                    >
                                      <span className="font-semibold text-background-dark dark:text-white">
                                        {bank.name}
                                      </span>
                                      {selectedBank === bank.code && (
                                        <span className="material-icons-outlined text-primary dark:text-primary ml-auto float-right text-sm">
                                          check
                                        </span>
                                      )}
                                    </button>
                                  ))}
                                {bankSearchQuery && availableBanks.filter(bank => 
                                  bank.name.toLowerCase().includes(bankSearchQuery.toLowerCase())
                                ).length === 0 && (
                                  <div className="p-4 text-center">
                                    <p className="text-sm text-background-dark/70 dark:text-white/60">No banks found matching "{bankSearchQuery}"</p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}

                      </div>
                    </div>
                  </>
                )}

                {/* Recipient input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2 text-background-dark dark:text-white/80">
                    {ngnRecipientType === "user" 
                      ? "Recipient Phone Number" 
                      : "Recipient Account Number"}
                  </label>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (ngnRecipientType === "bank") {
                        // Only allow digits, max 10
                        const cleaned = value.replace(/\D/g, "").slice(0, 10);
                        setRecipient(cleaned);
                        // Reset verification when account number changes
                        if (cleaned !== recipient) {
                          setVerifiedAccount(null);
                          setVerificationError(null);
                        }
                      } else {
                        setRecipient(value);
                      }
                    }}
                    placeholder={ngnRecipientType === "user" 
                      ? "Enter phone number (e.g., 07034494055)" 
                      : "Enter 10-digit account number"}
                    maxLength={ngnRecipientType === "bank" ? 10 : undefined}
                    className="w-full p-3 border border-primary/30 dark:border-white/20 rounded-xl bg-white/60 dark:bg-secondary/30 backdrop-blur-sm text-background-dark dark:text-white font-medium placeholder:text-background-dark/50 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  {ngnRecipientType === "user" && (
                    <p className="text-xs text-background-dark/70 dark:text-white/60 mt-1">
                      Enter recipient's Nigerian mobile number
                    </p>
                  )}
                  {ngnRecipientType === "bank" && (
                    <>
                      <p className="text-xs text-background-dark/70 dark:text-white/60 mt-1">
                        Enter 10-digit bank account number
                      </p>
                      {/* Account Verification Status */}
                      {verifyingAccount && (
                        <div className="mt-2 p-2 bg-blue-100/80 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-800 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            <p className="text-xs text-blue-700 dark:text-blue-300">Verifying account...</p>
                          </div>
                        </div>
                      )}
                      {verifiedAccount && !verifyingAccount && (
                        <div className="mt-2 p-3 bg-green-100/80 dark:bg-green-900/30 border border-green-300 dark:border-green-800 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="material-icons-outlined text-sm text-green-600 dark:text-green-400">check_circle</span>
                            <p className="text-xs font-semibold text-green-700 dark:text-green-300">Account Verified</p>
                          </div>
                          <p className="text-sm font-medium text-green-800 dark:text-green-200">
                            {verifiedAccount.accountName}
                          </p>
                          <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                            Account: {verifiedAccount.accountNumber}
                          </p>
                        </div>
                      )}
                      {verificationError && !verifyingAccount && !verifiedAccount && (
                        <div className="mt-2 p-3 bg-red-100/80 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="material-icons-outlined text-sm text-red-600 dark:text-red-400">error</span>
                            <p className="text-xs font-semibold text-red-700 dark:text-red-300">Verification Failed</p>
                          </div>
                          <p className="text-xs text-red-700 dark:text-red-400">
                            {verificationError}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Amount */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2 text-background-dark dark:text-white/80">
                    Amount (₦)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full p-3 border border-primary/30 dark:border-white/20 rounded-xl bg-white/60 dark:bg-secondary/30 backdrop-blur-sm text-background-dark dark:text-white font-medium placeholder:text-background-dark/50 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                {virtualAccount && (
                  <div className="mb-4 p-3 bg-primary/30 dark:bg-primary/10 border border-primary/50 dark:border-primary/30 rounded-xl">
                    <p className="text-xs text-background-dark/70 dark:text-white/70 mb-1">Your Balance</p>
                    <p className="text-lg font-bold text-background-dark dark:text-white">
                      ₦ {virtualAccount.balance || "0.00"}
                    </p>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-100/80 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-xl backdrop-blur-sm">
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">{error}</p>
              </div>
            )}

            {authenticating && (
              <div className="mb-4 p-3 bg-primary/30 border border-primary/50 rounded-xl backdrop-blur-sm">
                <p className="text-sm text-background-dark dark:text-white font-medium">
                  Authenticating with passkey... Please follow the prompt on your device.
                </p>
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={loading || !recipient || !amount || authenticating || 
                       (sendType === "crypto" && (availableChains.length === 0 || !selectedTokenInfo)) ||
                       (sendType === "ngn" && ngnRecipientType === "bank" && !selectedBank)}
              className="w-full bg-secondary hover:bg-secondary/90 text-background-dark dark:text-white font-semibold py-3 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg transition-colors"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <span className="material-icons-outlined">send</span>
                  <span>Send</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      <BottomNavigation />
    </div>
  );
}

export default function SendPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <SendPageContent />
    </Suspense>
  );
}
