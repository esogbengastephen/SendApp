"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { getUserFromStorage, clearUserSession } from "@/lib/session";
import { getTokenLogo, getChainLogo } from "@/lib/logos";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import { WalletCard } from "./WalletCard";
import { ServiceButton } from "./ServiceButton";
import BottomNavigation from "./BottomNavigation";
import NotificationBell from "./NotificationBell";

interface DashboardData {
  user: {
    email: string;
    accountNumber: string | null;
    bankName: string;
  };
  balance: {
    ngn: number;
    crypto: number;
  };
  walletAddresses?: Record<string, string>; // Add wallet addresses
  transactions: Array<{
    id: string;
    amount: number;
    sendAmount: number;
    date: string;
    txHash: string | null;
  }>;
  walletCount: number;
}

interface Service {
  id: string;
  name: string;
  icon: string;
  route: string;
}

const services: Service[] = [
  { id: "crypto-to-naira", name: "Crypto\nto Naira", icon: "currency_exchange", route: "/offramp" },
  { id: "naira-to-crypto", name: "Naira\nto Crypto", icon: "swap_vert", route: "/payment" },
  { id: "generate-invoice", name: "Generate\nInvoice", icon: "receipt_long", route: "/invoice" },
  { id: "create-prediction", name: "Create\nPrediction", icon: "trending_up", route: "/prediction" },
  { id: "buy-data", name: "Buy\nData", icon: "wifi", route: "/buy-data" },
  { id: "buy-airtime", name: "Buy\nAirtime", icon: "phone_iphone", route: "/buy-airtime" },
  { id: "pay-betting", name: "Pay\nBetting", icon: "sports_soccer", route: "/pay-betting" },
  { id: "tv-sub", name: "TV\nSub", icon: "tv", route: "/tv-sub" },
  { id: "buy-electricity", name: "Electricity", icon: "bolt", route: "/buy-electricity" },
  { id: "gift-card-redeem", name: "Gift Card\nRedeem", icon: "card_giftcard", route: "/gift-card-redeem" },
  { id: "flip-lend", name: "Flip\nLend", icon: "savings", route: "/flip-lend" },
];

/** Token icon for price banner: round, compact; fallback when image fails */
function TokenPriceIcon({ symbol }: { symbol: "SEND" | "USDC" | "USDT" }) {
  const [imgError, setImgError] = useState(false);
  const url = getTokenLogo(symbol);
  const circleClass = "w-5 h-5 min-w-[20px] min-h-[20px] rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden bg-primary/10 dark:bg-primary/20 relative";
  if (!url) {
    return (
      <div className={circleClass}>
        <span className="text-[10px] font-bold text-primary">$</span>
      </div>
    );
  }
  return (
    <div className={circleClass}>
      {imgError ? (
        <span className="text-[10px] font-bold text-primary" aria-hidden="true">$</span>
      ) : (
        <Image
          src={url}
          alt={symbol}
          width={20}
          height={20}
          className="absolute inset-0 rounded-full object-cover w-full h-full"
          unoptimized
          onError={() => setImgError(true)}
        />
      )}
    </div>
  );
}

export default function UserDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNGNBalance, setShowNGNBalance] = useState(true);
  const [showCryptoBalance, setShowCryptoBalance] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [insight, setInsight] = useState<string>("Loading market insights...");
  const [tokenPrices, setTokenPrices] = useState<{ SEND: string | null; USDC: string | null; USDT: string | null }>({ SEND: null, USDC: null, USDT: null });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [walletBalances, setWalletBalances] = useState<Record<string, { balance: string; usdValue: number; symbol: string }>>({});
  const [totalCryptoUSD, setTotalCryptoUSD] = useState(0);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [cachedTotalCryptoUSD, setCachedTotalCryptoUSD] = useState<number | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showCryptoOptions, setShowCryptoOptions] = useState(false);
  const [showOfframpOptions, setShowOfframpOptions] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showAssetsModal, setShowAssetsModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<{ chainId: string; tokenAddress: string; tokenInfo: any } | null>(null);
  const [showAssetActions, setShowAssetActions] = useState(false);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Helper function to extract first name from email
  const getFirstNameFromEmail = (email: string | undefined | null): string => {
    if (!email) return "User";
    
    try {
      // Extract the part before @
      const localPart = email.split("@")[0];
      if (!localPart) return "User";
      
      // Split by common separators and take the first part
      const firstName = localPart.split(/[._-]/)[0];
      if (!firstName) return "User";
      
      // Capitalize first letter
      return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    } catch {
      return "User";
    }
  };

  // Helper functions for caching balance
  const saveCachedBalance = (userId: string, totalUSD: number) => {
    try {
      localStorage.setItem(`cached_crypto_balance_${userId}`, JSON.stringify({
        totalUSD,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error("Error saving cached balance:", error);
    }
  };

  const loadCachedBalance = (userId: string): number | null => {
    try {
      const cached = localStorage.getItem(`cached_crypto_balance_${userId}`);
      if (cached) {
        const data = JSON.parse(cached);
        // Use cached balance if it's less than 5 minutes old
        if (Date.now() - data.timestamp < 5 * 60 * 1000) {
          return data.totalUSD;
        }
      }
    } catch (error) {
      console.error("Error loading cached balance:", error);
    }
    return null;
  };

  // Sync activeTab with current route
  useEffect(() => {
    if (pathname === "/" || pathname === "/dashboard") {
      setActiveTab("home");
    } else if (pathname.includes("/history")) {
      setActiveTab("history");
    } else if (pathname.includes("/upload") || pathname.includes("/send")) {
      setActiveTab("upload");
    } else if (pathname.includes("/chart") || pathname.includes("/analytics")) {
      setActiveTab("chart");
    } else if (pathname.includes("/www") || pathname.includes("/web")) {
      setActiveTab("www");
    }
  }, [pathname]);

  useEffect(() => {
    try {
      const currentUser = getUserFromStorage();
      if (!currentUser) {
        router.push("/auth");
        return;
      }
      setUser(currentUser);
      
      // Initialize theme immediately (synchronous) - with error handling for mobile
      try {
        if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
          const darkMode = localStorage.getItem("darkMode") === "true";
          setIsDarkMode(darkMode);
          if (typeof document !== "undefined") {
            if (darkMode) {
              document.documentElement.classList.add("dark");
            } else {
              document.documentElement.classList.remove("dark");
            }
          }
        }
      } catch (e) {
        console.warn("Error initializing theme:", e);
        // Continue without theme initialization
      }
      
      // Load cached balance immediately
      try {
        const cachedBalance = loadCachedBalance(currentUser.id);
        if (cachedBalance !== null) {
          setCachedTotalCryptoUSD(cachedBalance);
          setTotalCryptoUSD(cachedBalance);
        }
      } catch (e) {
        console.warn("Error loading cached balance:", e);
        // Continue without cached balance
      }
    
      // Parallelize API calls for faster loading
      Promise.all([
        fetchDashboardData(currentUser.id),
        fetchWalletBalances(currentUser.id),
        fetchUserProfile(currentUser.id),
        fetchTokenPrices(),
        fetchAllTransactions(currentUser.id),
      ]).catch((error) => {
        console.warn("Dashboard data load error:", error?.message ?? error);
      });
      
      // Refresh prices every 30 seconds; .catch() prevents unhandled rejection on "Failed to fetch"
      const priceInterval = setInterval(() => {
        fetchTokenPrices().catch(() => {});
      }, 30000);
      
      // Refresh wallet balances every 60 seconds; .catch() prevents unhandled rejection on "Failed to fetch"
      const balanceInterval = setInterval(() => {
        if (currentUser) {
          fetchWalletBalances(currentUser.id).catch(() => {});
        }
      }, 60000);
      
      return () => {
        clearInterval(priceInterval);
        clearInterval(balanceInterval);
      };
    } catch (error) {
      console.error("Error in UserDashboard useEffect:", error);
      // Don't crash the app - just log the error
    }
  }, [router]);

  const fetchTokenPrices = async () => {
    try {
      const response = await fetch(`/api/token-prices?t=${Date.now()}`);
      const data = await response.json();
      
      if (data.success && data.pricesNGN) {
        const { SEND, USDC, USDT } = data.pricesNGN;
        
        // Format NGN prices for display (use "NGN" so the Naira symbol ₦ doesn't look like "on" in some fonts)
        const formatPrice = (price: number | null) => {
          if (price === null) return "N/A";
          return `NGN ${price.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        };
        
        const sendPrice = formatPrice(SEND);
        const usdcPrice = formatPrice(USDC);
        const usdtPrice = formatPrice(USDT);
        
        setTokenPrices({ SEND: sendPrice, USDC: usdcPrice, USDT: usdtPrice });
        setInsight(`1 SEND: ${sendPrice} | 1 USDC: ${usdcPrice} | 1 USDT: ${usdtPrice}`);
      } else {
        setInsight("Unable to load token prices. Please try again later.");
      }
    } catch (error) {
      console.error("Error fetching token prices:", error);
      setInsight("Unable to load token prices. Please try again later.");
    }
  };

  const fetchDashboardData = async (userId: string) => {
    try {
      const response = await fetch(`/api/user/dashboard?userId=${userId}`);
      const data = await response.json();

      if (data.success) {
        setDashboardData(data.data);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTransactions = async (userId: string) => {
    setLoadingTransactions(true);
    try {
      const response = await fetch(`/api/user/transactions?userId=${userId}&limit=10`);
      const data = await response.json();

      if (data.success) {
        setAllTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const fetchWalletBalances = async (userId: string) => {
    setLoadingBalances(true);
    try {
      const response = await fetch(`/api/wallet/balances?userId=${userId}`);
      const data = await response.json();

      if (data.success) {
        console.log("[Frontend] Wallet balances response:", data);
        console.log("[Frontend] Balances structure:", data.balances);
        console.log("[Frontend] Total USD:", data.totalUSD);
        
        const newTotalUSD = data.totalUSD || 0;
        setWalletBalances(data.balances || {});
        setTotalCryptoUSD(newTotalUSD);
        
        // Save to cache
        saveCachedBalance(userId, newTotalUSD);
        setCachedTotalCryptoUSD(newTotalUSD);
        
        // Log individual tokens for debugging
        if (data.balances) {
          Object.entries(data.balances).forEach(([chainId, chainBalances]: [string, any]) => {
            console.log(`[Frontend] Chain ${chainId} has ${Object.keys(chainBalances).length} tokens`);
            Object.entries(chainBalances).forEach(([tokenAddress, tokenInfo]: [string, any]) => {
              console.log(`[Frontend]   Token: ${tokenInfo.symbol} - Balance: ${tokenInfo.balance}, USD: $${tokenInfo.usdValue}`);
            });
          });
        }
      } else {
        console.error("[Frontend] API returned success: false", data);
      }
    } catch (error) {
      console.error("Error fetching wallet balances:", error);
    } finally {
      setLoadingBalances(false);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    if (!userId) {
      console.error("[UserDashboard] No userId provided");
      return;
    }
    
    try {
      const response = await fetch(`/api/user/profile?userId=${userId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[UserDashboard] Profile API error:", response.status, errorData);
        return;
      }
      
      const data = await response.json();
      if (data.success && data.profile) {
        setUserProfile(data.profile);
      } else {
        console.error("[UserDashboard] Profile API returned unsuccessful:", data);
      }
    } catch (error) {
      console.error("[UserDashboard] Error fetching profile:", error);
    }
  };

  const handleServiceClick = (service: Service) => {
    // Map services to existing routes
    if (service.id === "crypto-to-naira") {
      // Show modal with options instead of routing directly
      setShowOfframpOptions(true);
    } else if (service.id === "naira-to-crypto") {
      // Show modal with options instead of routing directly
      setShowCryptoOptions(true);
    } else if (service.route) {
      // Navigate to the service route
      router.push(service.route);
    } else {
      // For other services without routes, show coming soon
      alert(`${service.name} coming soon!`);
    }
  };

  const handleCryptoOptionClick = (option: "SEND" | "BASE" | "SOLANA") => {
    setShowCryptoOptions(false);
    if (option === "SEND") {
      router.push("/payment");
    } else if (option === "BASE") {
      router.push("/payment?network=base");
    } else if (option === "SOLANA") {
      router.push("/payment?network=solana");
    }
  };

  const handleOfframpOptionClick = (option: "SEND" | "BASE" | "SOLANA") => {
    setShowOfframpOptions(false);
    // Map SEND to base network but with type=send for display
    if (option === "SEND") {
      router.push("/offramp?network=base&type=send");
    } else if (option === "BASE") {
      router.push("/offramp?network=base&type=base");
    } else if (option === "SOLANA") {
      router.push("/offramp?network=solana&type=solana");
    }
  };

  const copyAccountNumber = () => {
    if (dashboardData?.user.accountNumber) {
      navigator.clipboard.writeText(dashboardData.user.accountNumber);
      alert("Account number copied!");
    }
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      clearUserSession();
      router.push("/auth");
    }
  };

  const toggleTheme = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("darkMode", "true");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("darkMode", "false");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-4"></div>
          <p className="text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden bg-ds-bg-light dark:bg-background-dark pb-24">
      {/* Header Background */}
      <div className="absolute top-0 left-0 w-full h-[380px] bg-primary rounded-b-[3rem] z-0 overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute top-20 -left-10 w-48 h-48 bg-white opacity-10 rounded-full blur-2xl"></div>
      </div>

      <div className="relative z-10 px-4 sm:px-6 pt-12 flex-grow flex flex-col">
        {/* Profile Header */}
        <div className="flex justify-between items-center mb-6 text-secondary">
          <button
            onClick={() => router.push("/settings")}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity duration-motion-fast cursor-pointer group"
            aria-label="Open Settings"
            title="Tap to open settings"
          >
            {userProfile?.photoUrl ? (
              <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-secondary/20 group-hover:border-secondary/40 transition-colors duration-motion-fast">
                <Image
                  src={userProfile.photoUrl}
                  alt={userProfile.displayName || "Profile"}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center border-2 border-secondary/10 group-hover:border-secondary/30 transition-colors duration-motion-fast">
                <span className="material-icons-outlined text-secondary text-2xl">face</span>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-secondary/70">Welcome back,</p>
              <h1 className="text-xl font-bold leading-tight text-secondary group-hover:underline">
                {userProfile?.displayName || user?.displayName || getFirstNameFromEmail(userProfile?.email || user?.email)}
              </h1>
            </div>
          </button>
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="bg-secondary/10 p-2 rounded-full hover:bg-secondary/20 transition-all duration-motion-fast backdrop-blur-sm"
              aria-label="Toggle theme"
            >
              <span className="material-icons-outlined text-secondary/70 text-xl">
                {isDarkMode ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            {/* Notifications Button */}
            <NotificationBell />
            {/* Logout Button */}
            <button 
              onClick={handleLogout}
              className="bg-secondary/10 p-2 rounded-full hover:bg-secondary/20 transition-all duration-motion-fast backdrop-blur-sm"
              aria-label="Logout"
            >
              <span className="material-icons-outlined text-secondary/70 text-xl">power_settings_new</span>
            </button>
          </div>
        </div>

        {/* Token Price Banner: compact */}
        <div className="mb-3 bg-white dark:bg-ds-dark-surface-soft backdrop-blur-sm rounded-ds-md border border-ds-border dark:border-white/10 overflow-hidden relative shadow-ds-soft">
          <p className="text-[9px] font-bold text-ds-text-secondary uppercase tracking-tighter mb-0.5 px-3 pt-1.5">Token Price</p>
          <div className="relative h-6 overflow-hidden">
            <div className="animate-marquee whitespace-nowrap flex items-center">
              {/* First set of prices */}
              <div className="flex items-center gap-5 px-3 sm:px-4 inline-flex">
                {tokenPrices.SEND && (
                  <div className="flex items-center gap-1.5">
                    <TokenPriceIcon symbol="SEND" />
                    <span className="text-[10px] text-ds-text-primary font-medium whitespace-nowrap">1 SEND: {tokenPrices.SEND}</span>
                  </div>
                )}
                {tokenPrices.USDC && (
                  <div className="flex items-center gap-1.5">
                    <TokenPriceIcon symbol="USDC" />
                    <span className="text-[10px] text-ds-text-primary font-medium whitespace-nowrap">1 USDC: {tokenPrices.USDC}</span>
                  </div>
                )}
                {tokenPrices.USDT && (
                  <div className="flex items-center gap-1.5">
                    <TokenPriceIcon symbol="USDT" />
                    <span className="text-[10px] text-ds-text-primary font-medium whitespace-nowrap">1 USDT: {tokenPrices.USDT}</span>
                  </div>
                )}
              </div>
              {/* Duplicate for seamless scrolling */}
              <div className="flex items-center gap-5 px-3 sm:px-4 inline-flex">
                {tokenPrices.SEND && (
                  <div className="flex items-center gap-1.5">
                    <TokenPriceIcon symbol="SEND" />
                    <span className="text-[10px] text-ds-text-primary font-medium whitespace-nowrap">1 SEND: {tokenPrices.SEND}</span>
                  </div>
                )}
                {tokenPrices.USDC && (
                  <div className="flex items-center gap-1.5">
                    <TokenPriceIcon symbol="USDC" />
                    <span className="text-[10px] text-ds-text-primary font-medium whitespace-nowrap">1 USDC: {tokenPrices.USDC}</span>
                  </div>
                )}
                {tokenPrices.USDT && (
                  <div className="flex items-center gap-1.5">
                    <TokenPriceIcon symbol="USDT" />
                    <span className="text-[10px] text-ds-text-primary font-medium whitespace-nowrap">1 USDT: {tokenPrices.USDT}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Wallet Section: white container in light mode so cards + primary buttons stand out; surface in dark */}
        <div className="bg-white dark:bg-ds-dark-surface backdrop-blur-md rounded-ds-xl p-4 sm:p-ds-5 border border-ds-border dark:border-white/10 shadow-ds-soft mb-6 relative animate-card-enter">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
            <div className="min-w-0">
              <WalletCard 
                label="NGN"
              currency="NGN"
              amount={`₦ ${(dashboardData?.balance.ngn || 0).toLocaleString()}`}
              isHidden={!showNGNBalance}
              onToggleVisibility={() => setShowNGNBalance(!showNGNBalance)}
              accountNumber={dashboardData?.user.accountNumber || undefined}
              icon="account_balance_wallet"
              />
            </div>
            <div className="min-w-0">
              <WalletCard 
                label="Crypto"
              currency="Crypto"
              amount={loadingBalances && cachedTotalCryptoUSD === null
                ? "Loading..." 
                : `$ ${(totalCryptoUSD || cachedTotalCryptoUSD || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              }
              isHidden={!showCryptoBalance}
              onToggleVisibility={() => setShowCryptoBalance(!showCryptoBalance)}
              onViewAssets={() => setShowAssetsModal(true)}
              icon="currency_bitcoin"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 px-2">
            <button 
              onClick={() => router.push("/send")}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-10 h-10 rounded-ds-md bg-ds-primary text-secondary flex items-center justify-center shadow-ds-soft group-active:scale-[0.98] transition-transform duration-motion-fast ease-standard">
                <span className="material-icons-round text-lg transform -rotate-45">arrow_upward</span>
              </div>
              <span className="text-[10px] font-bold text-ds-text-primary uppercase tracking-wide">Send</span>
            </button>
            <button 
              onClick={() => router.push("/receive")}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-10 h-10 rounded-ds-md bg-ds-primary text-secondary flex items-center justify-center shadow-ds-soft group-active:scale-[0.98] transition-transform duration-motion-fast ease-standard">
                <span className="material-icons-round text-lg rotate-135" style={{ transform: 'matrix(-0.707107, 0.707107, -0.707107, -0.707107, 0, 0) rotate(45deg)' }}>arrow_downward</span>
              </div>
              <span className="text-[10px] font-bold text-ds-text-primary uppercase tracking-wide">Receive</span>
            </button>
          </div>

          <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 w-12 h-6 bg-ds-primary rounded-b-full flex items-center justify-center shadow-ds-soft z-20">
            <span className="material-icons-round text-secondary text-sm">keyboard_arrow_down</span>
          </div>
        </div>

        {/* Services Section - neutral bg; light gray tint in light mode for soft separation */}
        <div className="mt-ds-7 bg-white dark:bg-ds-dark-surface rounded-ds-xl p-ds-5 shadow-ds-soft border border-ds-border dark:border-white/5">
          <h3 className="text-[10px] font-bold text-ds-text-secondary mb-4 px-1 uppercase tracking-wider">Services</h3>
          <div className="grid grid-cols-4 gap-ds-4">
            <ServiceButton icon="currency_exchange" label={"Crypto\nto Naira"} useCustomIcon comingSoon />
            <ServiceButton icon="swap_vert" label={"Naira\nto Crypto"} useCustomIcon onClick={() => handleServiceClick(services[1])} />
            <ServiceButton icon="receipt_long" label={"Generate\nInvoice"} comingSoon />
            <ServiceButton icon="trending_up" label={"Create\nPrediction"} comingSoon />
            <ServiceButton icon="wifi" label={"Buy\nData"} comingSoon />
            <ServiceButton icon="phone_iphone" label={"Buy\nAirtime"} comingSoon />
            <ServiceButton icon="sports_soccer" label={"Pay\nBetting"} comingSoon />
            <ServiceButton icon="tv" label={"TV\nSub"} comingSoon />
            <ServiceButton icon="bolt" label={"Electricity"} comingSoon />
            <ServiceButton icon="card_giftcard" label={"Gift Card\nRedeem"} comingSoon />
            <ServiceButton icon="savings" label={"Flip\nLend"} comingSoon />
          </div>
        </div>

        {/* Transaction History */}
        <div className="mt-8 mb-8">
          <div className="flex justify-between items-center mb-4 px-1">
            <h3 className="text-[10px] font-bold text-background-dark dark:text-white uppercase tracking-wider">Transaction history</h3>
            <button 
              onClick={() => router.push("/history")}
              className="text-xs text-gray-600 dark:text-white/60 font-medium hover:text-primary transition-colors"
            >
              View All
            </button>
          </div>
          {loadingTransactions ? (
            <div className="bg-white dark:bg-card-dark rounded-3xl p-8 shadow-md min-h-[160px] flex items-center justify-center border border-gray-100 dark:border-white/5">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">Loading transactions...</p>
              </div>
            </div>
          ) : allTransactions.length > 0 ? (
            <div className="bg-white dark:bg-card-dark rounded-3xl p-4 shadow-md border border-gray-100 dark:border-white/5">
              <div className="space-y-2">
                {allTransactions.slice(0, 5).map((tx) => {
                  const getStatusColor = (status: string) => {
                    if (status === "completed" || status === "paid") return "text-green-600 dark:text-green-400";
                    if (status === "failed") return "text-red-600 dark:text-red-400";
                    return "text-yellow-600 dark:text-yellow-400";
                  };

                  const getStatusBg = (status: string) => {
                    if (status === "completed" || status === "paid") return "bg-green-100 dark:bg-green-900/30";
                    if (status === "failed") return "bg-red-100 dark:bg-red-900/30";
                    return "bg-yellow-100 dark:bg-yellow-900/30";
                  };

                  const getStatusLabel = (status: string) => {
                    if (status === "completed" || status === "paid") return "Successful";
                    if (status === "failed") return "Failed";
                    return "Pending";
                  };

                  return (
                    <div
                      key={tx.id}
                      onClick={() => router.push(`/history?tx=${tx.id}&type=${tx.type}`)}
                      className="bg-white/60 dark:bg-white/5 rounded-xl p-3 flex items-center justify-between hover:bg-white/80 dark:hover:bg-white/10 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-full ${getStatusBg(tx.status)} flex items-center justify-center flex-shrink-0`}>
                          <span className={`material-icons-outlined ${getStatusColor(tx.status)}`}>{tx.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {tx.title}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-white/60 truncate">
                            {tx.description}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5">
                            {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {tx.amountLabel}
                        </p>
                        {tx.secondaryAmountLabel && (
                          <p className="text-xs font-medium text-primary">
                            {tx.secondaryAmountLabel}
                          </p>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusBg(tx.status)} ${getStatusColor(tx.status)} font-medium`}>
                          {getStatusLabel(tx.status)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-card-dark rounded-3xl p-8 shadow-md min-h-[160px] flex items-center justify-center border border-gray-100 dark:border-white/5">
              <div className="text-center opacity-50">
                <span className="material-icons-outlined text-4xl text-gray-300 dark:text-gray-600 mb-2">receipt</span>
                <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">No recent transactions</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Crypto Options Modal */}
      {showCryptoOptions && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-sm"
          onClick={() => setShowCryptoOptions(false)}
        >
          <div 
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-sm w-full p-6 border-2 border-primary/20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* FlipPay Logo */}
            <div className="flex justify-center mb-6">
              <img 
                src="/whitelogo.png" 
                alt="FlipPay" 
                className="h-12 w-auto dark:hidden"
              />
              <img 
                src="/logo.png" 
                alt="FlipPay" 
                className="h-12 w-auto hidden dark:block"
              />
            </div>

            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Select Crypto Network
              </h3>
              <button
                onClick={() => setShowCryptoOptions(false)}
                className="text-gray-600 hover:text-gray-900 dark:text-white/60 dark:hover:text-white transition-colors"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => handleCryptoOptionClick("SEND")}
                className="w-full p-4 rounded-xl bg-primary/10 hover:bg-primary/20 border-2 border-primary/30 hover:border-primary/50 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center overflow-hidden relative">
                    {/* SEND Token Logo - /s logo on green background */}
                    <Image
                      src="https://res.cloudinary.com/dshqnkjqb/image/upload/v1766979129/71a616bbd4464dfc8c7a5dcb4b3ee043_fe2oeg.png"
                      alt="SEND"
                      width={40}
                      height={40}
                      className="rounded-lg"
                      unoptimized
                      onError={(e) => {
                        // Fallback to icon if image fails
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) {
                          parent.innerHTML = '<span class="material-icons-outlined text-primary text-2xl">token</span>';
                        }
                      }}
                    />
                  </div>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">SEND</span>
                </div>
                <span className="material-icons-outlined text-gray-600 dark:text-white/40 group-hover:text-primary transition-colors">
                  arrow_forward
                </span>
              </button>

              <div
                className="w-full p-4 rounded-xl bg-gray-100 dark:bg-slate-700/50 border-2 border-gray-200 dark:border-slate-600 flex items-center justify-between opacity-75 cursor-not-allowed"
                aria-disabled="true"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden">
                    <Image
                      src="https://res.cloudinary.com/dshqnkjqb/image/upload/v1766979509/108554348_rdxd9x.png"
                      alt="BASE"
                      width={40}
                      height={40}
                      className="rounded-lg opacity-70"
                      unoptimized
                    />
                  </div>
                  <span className="text-lg font-semibold text-gray-500 dark:text-gray-400">BASE</span>
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Coming soon</span>
              </div>

              <div
                className="w-full p-4 rounded-xl bg-gray-100 dark:bg-slate-700/50 border-2 border-gray-200 dark:border-slate-600 flex items-center justify-between opacity-75 cursor-not-allowed"
                aria-disabled="true"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden">
                    <Image
                      src="https://assets.coingecko.com/coins/images/4128/small/solana.png"
                      alt="SOLANA"
                      width={40}
                      height={40}
                      className="rounded-lg opacity-70"
                      unoptimized
                    />
                  </div>
                  <span className="text-lg font-semibold text-gray-500 dark:text-gray-400">SOLANA</span>
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Coming soon</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Crypto to Naira Options Modal */}
      {showOfframpOptions && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-sm"
          onClick={() => setShowOfframpOptions(false)}
        >
          <div 
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-sm w-full p-6 border-2 border-primary/20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* FlipPay Logo */}
            <div className="flex justify-center mb-6">
              <img 
                src="/whitelogo.png" 
                alt="FlipPay" 
                className="h-12 w-auto dark:hidden"
              />
              <img 
                src="/logo.png" 
                alt="FlipPay" 
                className="h-12 w-auto hidden dark:block"
              />
            </div>

            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Select Crypto Network
              </h3>
              <button
                onClick={() => setShowOfframpOptions(false)}
                className="text-gray-600 hover:text-gray-900 dark:text-white/60 dark:hover:text-white transition-colors"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => handleOfframpOptionClick("SEND")}
                className="w-full p-4 rounded-xl bg-primary/10 hover:bg-primary/20 border-2 border-primary/30 hover:border-primary/50 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center overflow-hidden relative">
                    {/* SEND Token Logo - /s logo on green background */}
                    <Image
                      src="https://res.cloudinary.com/dshqnkjqb/image/upload/v1766979129/71a616bbd4464dfc8c7a5dcb4b3ee043_fe2oeg.png"
                      alt="SEND"
                      width={40}
                      height={40}
                      className="rounded-lg"
                      unoptimized
                      onError={(e) => {
                        // Fallback to icon if image fails
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) {
                          parent.innerHTML = '<span class="material-icons-outlined text-secondary text-2xl">token</span>';
                        }
                      }}
                    />
                  </div>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">SEND</span>
                </div>
                <span className="material-icons-outlined text-gray-600 dark:text-white/40 group-hover:text-primary transition-colors">
                  arrow_forward
                </span>
              </button>

              <button
                onClick={() => handleOfframpOptionClick("BASE")}
                className="w-full p-4 rounded-xl bg-primary/10 hover:bg-primary/20 border-2 border-primary/30 hover:border-primary/50 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center overflow-hidden">
                    {/* Base Logo */}
                    <Image
                      src="https://res.cloudinary.com/dshqnkjqb/image/upload/v1766979509/108554348_rdxd9x.png"
                      alt="BASE"
                      width={40}
                      height={40}
                      className="rounded-lg"
                      unoptimized
                      onError={(e) => {
                        // Fallback to icon if image fails
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) {
                          parent.innerHTML = '<span class="material-icons-outlined text-secondary">account_balance</span>';
                        }
                      }}
                    />
                  </div>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">BASE</span>
                </div>
                <span className="material-icons-outlined text-gray-600 dark:text-white/40 group-hover:text-primary transition-colors">
                  arrow_forward
                </span>
              </button>

              <button
                onClick={() => handleOfframpOptionClick("SOLANA")}
                className="w-full p-4 rounded-xl bg-primary/10 hover:bg-primary/20 border-2 border-primary/30 hover:border-primary/50 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center overflow-hidden">
                    <Image
                      src="https://assets.coingecko.com/coins/images/4128/small/solana.png"
                      alt="SOLANA"
                      width={40}
                      height={40}
                      className="rounded-lg"
                      unoptimized
                      onError={(e) => {
                        // Fallback to icon if image fails
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) {
                          parent.innerHTML = '<span class="material-icons-outlined text-secondary">account_balance_wallet</span>';
                        }
                      }}
                    />
                  </div>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">SOLANA</span>
                </div>
                <span className="material-icons-outlined text-gray-600 dark:text-white/40 group-hover:text-primary transition-colors">
                  arrow_forward
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crypto Assets Modal */}
      {showAssetsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-icons-outlined">account_balance_wallet</span>
                Crypto Assets
              </h2>
              <button
                onClick={() => setShowAssetsModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <span className="material-icons-outlined text-gray-600 dark:text-gray-400">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingBalances ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-3 text-gray-600 dark:text-gray-400">Loading assets...</span>
                </div>
              ) : Object.keys(walletBalances).length === 0 ? (
                <div className="text-center py-12">
                  <span className="material-icons-outlined text-6xl text-gray-400 dark:text-gray-600 mb-4">account_balance_wallet</span>
                  <p className="text-gray-600 dark:text-gray-400">No crypto assets found</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Set up your wallet to start receiving crypto</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(() => {
                    // Sort chains: Base first, Solana second, then others
                    const chainEntries = Object.entries(walletBalances);
                    const sortedChains = chainEntries.sort(([chainIdA], [chainIdB]) => {
                      if (chainIdA === 'base') return -1;
                      if (chainIdB === 'base') return 1;
                      if (chainIdA === 'solana') return -1;
                      if (chainIdB === 'solana') return 1;
                      return chainIdA.localeCompare(chainIdB);
                    });
                    
                    return sortedChains.map(([chainId, chainBalances]: [string, any]) => {
                      const chain = SUPPORTED_CHAINS[chainId];
                      const chainTotalUSD = Object.values(chainBalances).reduce((sum: number, token: any) => sum + (token.usdValue || 0), 0);
                      
                      return (
                      <div key={chainId} className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                        {/* Chain Header */}
                        <div className="bg-gray-50 dark:bg-slate-800 p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getChainLogo(chainId) && (
                              <Image
                                src={getChainLogo(chainId)}
                                alt={chain?.name || chainId}
                                width={24}
                                height={24}
                                className="rounded-full"
                                unoptimized
                              />
                            )}
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-white">
                                {chain?.name || chainId}
                              </h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {Object.keys(chainBalances).length} {Object.keys(chainBalances).length === 1 ? 'asset' : 'assets'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              ${chainTotalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>

                        {/* Tokens */}
                        <div className="divide-y divide-gray-200 dark:divide-slate-700">
                          {Object.entries(chainBalances).map(([tokenAddress, tokenInfo]: [string, any]) => (
                            <div 
                              key={tokenAddress} 
                              onClick={() => {
                                setSelectedAsset({ chainId, tokenAddress, tokenInfo });
                                setShowAssetActions(true);
                              }}
                              className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer active:bg-gray-100 dark:active:bg-slate-800"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                {getTokenLogo(tokenInfo.symbol) && (
                                  <Image
                                    src={getTokenLogo(tokenInfo.symbol)}
                                    alt={tokenInfo.symbol}
                                    width={32}
                                    height={32}
                                    className="rounded-full"
                                    unoptimized
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-gray-900 dark:text-white">
                                    {tokenInfo.symbol}
                                  </p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                    {tokenInfo.balance} {tokenInfo.symbol}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right flex items-center gap-2">
                                <div>
                                  <p className="font-semibold text-gray-900 dark:text-white">
                                    ${(tokenInfo.usdValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                </div>
                                <span className="material-icons-outlined text-gray-400 dark:text-gray-500 text-sm">
                                  chevron_right
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })})()}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Value</span>
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  ${(totalCryptoUSD || cachedTotalCryptoUSD || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Asset Actions Modal */}
      {showAssetActions && selectedAsset && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                {getTokenLogo(selectedAsset.tokenInfo.symbol) && (
                  <Image
                    src={getTokenLogo(selectedAsset.tokenInfo.symbol)}
                    alt={selectedAsset.tokenInfo.symbol}
                    width={40}
                    height={40}
                    className="rounded-full"
                    unoptimized
                  />
                )}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedAsset.tokenInfo.symbol}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedAsset.tokenInfo.balance} {selectedAsset.tokenInfo.symbol}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAssetActions(false);
                  setSelectedAsset(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <span className="material-icons-outlined text-gray-600 dark:text-gray-400">close</span>
              </button>
            </div>

            {/* Actions */}
            <div className="p-6 space-y-3">
              <button
                onClick={() => {
                  setShowAssetActions(false);
                  setShowAssetsModal(false);
                  router.push(`/send?chain=${selectedAsset.chainId}&token=${selectedAsset.tokenAddress}&type=crypto`);
                }}
                className="w-full flex items-center gap-3 p-4 bg-primary hover:bg-primary/90 text-secondary rounded-xl transition-colors"
              >
                <span className="material-icons-outlined">send</span>
                <span className="font-semibold">Send {selectedAsset.tokenInfo.symbol}</span>
              </button>

              <button
                onClick={() => {
                  setShowAssetActions(false);
                  setShowAssetsModal(false);
                  router.push(`/payment?chain=${selectedAsset.chainId}&token=${selectedAsset.tokenAddress}`);
                }}
                className="w-full flex items-center gap-3 p-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-900 dark:text-white rounded-xl transition-colors"
              >
                <span className="material-icons-outlined">payment</span>
                <span className="font-semibold">Use for Payment</span>
              </button>

              <button
                onClick={() => {
                  setShowAssetActions(false);
                  setShowAssetsModal(false);
                  router.push(`/offramp?chain=${selectedAsset.chainId}&token=${selectedAsset.tokenAddress}`);
                }}
                className="w-full flex items-center gap-3 p-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-900 dark:text-white rounded-xl transition-colors"
              >
                <span className="material-icons-outlined">currency_exchange</span>
                <span className="font-semibold">Convert to Naira</span>
              </button>

              <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 mb-1">Chain</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {SUPPORTED_CHAINS[selectedAsset.chainId]?.name || selectedAsset.chainId}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 mb-1">Value</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      ${(selectedAsset.tokenInfo.usdValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNavigation />
    </div>
  );
}
