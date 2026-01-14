"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { getUserFromStorage, clearUserSession } from "@/lib/session";
import { getTokenLogo } from "@/lib/logos";
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
];

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
    const currentUser = getUserFromStorage();
    if (!currentUser) {
      router.push("/auth");
      return;
    }
    setUser(currentUser);
    
    // Initialize theme immediately (synchronous)
    const darkMode = localStorage.getItem("darkMode") === "true";
    setIsDarkMode(darkMode);
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    
    // Load cached balance immediately
    const cachedBalance = loadCachedBalance(currentUser.id);
    if (cachedBalance !== null) {
      setCachedTotalCryptoUSD(cachedBalance);
      setTotalCryptoUSD(cachedBalance);
    }
    
    // Parallelize API calls for faster loading
    Promise.all([
      fetchDashboardData(currentUser.id),
      fetchWalletBalances(currentUser.id),
      fetchUserProfile(currentUser.id),
      fetchTokenPrices(),
    ]).catch((error) => {
      console.error("Error loading dashboard data:", error);
    });
    
    // Refresh prices every 30 seconds
    const priceInterval = setInterval(() => {
      fetchTokenPrices();
    }, 30000);
    
    // Refresh wallet balances every 60 seconds
    const balanceInterval = setInterval(() => {
      if (currentUser) {
        fetchWalletBalances(currentUser.id);
      }
    }, 60000);
    
    return () => {
      clearInterval(priceInterval);
      clearInterval(balanceInterval);
    };
  }, [router]);

  const fetchTokenPrices = async () => {
    try {
      const response = await fetch(`/api/token-prices?t=${Date.now()}`);
      const data = await response.json();
      
      if (data.success && data.pricesNGN) {
        const { SEND, USDC, USDT } = data.pricesNGN;
        
        // Format NGN prices for display
        const formatPrice = (price: number | null) => {
          if (price === null) return "N/A";
          // Format NGN prices with comma separators
          return `₦${price.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      alert("BASE coming soon!");
    } else if (option === "SOLANA") {
      alert("SOLANA coming soon!");
    }
  };

  const handleOfframpOptionClick = (option: "SEND" | "BASE" | "SOLANA") => {
    setShowOfframpOptions(false);
    alert(`${option} coming soon!`);
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
    <div className="min-h-screen flex flex-col relative overflow-x-hidden bg-background-light dark:bg-background-dark pb-24">
      {/* Header Background */}
      <div className="absolute top-0 left-0 w-full h-[380px] bg-primary rounded-b-[3rem] z-0 overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute top-20 -left-10 w-48 h-48 bg-white opacity-10 rounded-full blur-2xl"></div>
      </div>

      <div className="relative z-10 px-6 pt-12 flex-grow flex flex-col">
        {/* Profile Header */}
        <div className="flex justify-between items-center mb-6 text-secondary">
          <button
            onClick={() => router.push("/settings")}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer group"
            aria-label="Open Settings"
            title="Tap to open settings"
          >
            {userProfile?.photoUrl ? (
              <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-secondary/20 group-hover:border-secondary/40 transition-colors">
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
              <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center border-2 border-secondary/10 group-hover:border-secondary/30 transition-colors">
                <span className="material-icons-outlined text-secondary text-2xl">face</span>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold opacity-70 text-secondary/70">Welcome back,</p>
              <h1 className="text-xl font-bold leading-tight text-secondary group-hover:underline">
                {userProfile?.displayName || user?.displayName || "LightBlock"}
              </h1>
            </div>
          </button>
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="bg-secondary/10 p-2 rounded-full hover:bg-secondary/20 transition backdrop-blur-sm"
              aria-label="Toggle theme"
            >
              <span className="material-icons-outlined text-secondary text-xl">
                {isDarkMode ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            {/* History Button */}
            <button className="bg-secondary/10 p-2 rounded-full hover:bg-secondary/20 transition backdrop-blur-sm">
              <span className="material-icons-outlined text-secondary text-xl">history</span>
            </button>
            {/* Notifications Button */}
            <NotificationBell />
            {/* Logout Button */}
            <button 
              onClick={handleLogout}
              className="bg-secondary/10 p-2 rounded-full hover:bg-secondary/20 transition backdrop-blur-sm"
              aria-label="Logout"
            >
              <span className="material-icons-outlined text-secondary text-xl">power_settings_new</span>
            </button>
          </div>
        </div>

        {/* Token Price Banner with Scrolling */}
        <div className="mb-4 bg-white/30 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden relative">
          <p className="text-[10px] font-bold text-gray-700 dark:text-white/60 uppercase tracking-tighter mb-1 px-4 pt-2">Token Price</p>
          <div className="relative h-8 overflow-hidden">
            <div className="animate-marquee whitespace-nowrap flex items-center">
              {/* First set of prices */}
              <div className="flex items-center gap-4 px-4 inline-flex">
                {tokenPrices.SEND && (
                  <div className="flex items-center gap-1.5">
                    {getTokenLogo("SEND") && (
                      <Image
                        src={getTokenLogo("SEND")}
                        alt="SEND"
                        width={16}
                        height={16}
                        className="rounded-full"
                        unoptimized
                      />
                    )}
                    <span className="text-xs text-gray-900 dark:text-white font-medium">1 SEND: {tokenPrices.SEND}</span>
                  </div>
                )}
                {tokenPrices.USDC && (
                  <div className="flex items-center gap-1.5">
                    {getTokenLogo("USDC") && (
                      <Image
                        src={getTokenLogo("USDC")}
                        alt="USDC"
                        width={16}
                        height={16}
                        className="rounded-full"
                        unoptimized
                      />
                    )}
                    <span className="text-xs text-gray-900 dark:text-white font-medium">1 USDC: {tokenPrices.USDC}</span>
                  </div>
                )}
                {tokenPrices.USDT && (
                  <div className="flex items-center gap-1.5">
                    {getTokenLogo("USDT") && (
                      <Image
                        src={getTokenLogo("USDT")}
                        alt="USDT"
                        width={16}
                        height={16}
                        className="rounded-full"
                        unoptimized
                      />
                    )}
                    <span className="text-xs text-gray-900 dark:text-white font-medium">1 USDT: {tokenPrices.USDT}</span>
                  </div>
                )}
              </div>
              {/* Duplicate for seamless scrolling */}
              <div className="flex items-center gap-4 px-4 inline-flex">
                {tokenPrices.SEND && (
                  <div className="flex items-center gap-1.5">
                    {getTokenLogo("SEND") && (
                      <Image
                        src={getTokenLogo("SEND")}
                        alt="SEND"
                        width={16}
                        height={16}
                        className="rounded-full"
                        unoptimized
                      />
                    )}
                    <span className="text-xs text-gray-900 dark:text-white font-medium">1 SEND: {tokenPrices.SEND}</span>
                  </div>
                )}
                {tokenPrices.USDC && (
                  <div className="flex items-center gap-1.5">
                    {getTokenLogo("USDC") && (
                      <Image
                        src={getTokenLogo("USDC")}
                        alt="USDC"
                        width={16}
                        height={16}
                        className="rounded-full"
                        unoptimized
                      />
                    )}
                    <span className="text-xs text-gray-900 dark:text-white font-medium">1 USDC: {tokenPrices.USDC}</span>
                  </div>
                )}
                {tokenPrices.USDT && (
                  <div className="flex items-center gap-1.5">
                    {getTokenLogo("USDT") && (
                      <Image
                        src={getTokenLogo("USDT")}
                        alt="USDT"
                        width={16}
                        height={16}
                        className="rounded-full"
                        unoptimized
                      />
                    )}
                    <span className="text-xs text-gray-900 dark:text-white font-medium">1 USDT: {tokenPrices.USDT}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Wallet Section */}
        <div className="bg-white/40 dark:bg-white/20 backdrop-blur-md rounded-3xl p-4 border border-white/30 shadow-sm mb-6 relative">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <WalletCard 
              label="NGN"
              currency="NGN"
              amount={`₦ ${(dashboardData?.balance.ngn || 0).toLocaleString()}`}
              isHidden={!showNGNBalance}
              onToggleVisibility={() => setShowNGNBalance(!showNGNBalance)}
              accountNumber={dashboardData?.user.accountNumber || undefined}
              icon="account_balance_wallet"
            />
            <WalletCard 
              label="Crypto"
              currency="Crypto"
              amount={loadingBalances && cachedTotalCryptoUSD === null
                ? "Loading..." 
                : `$ ${(totalCryptoUSD || cachedTotalCryptoUSD || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              }
              isHidden={!showCryptoBalance}
              onToggleVisibility={() => setShowCryptoBalance(!showCryptoBalance)}
              icon="currency_bitcoin"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 px-2">
            <button 
              onClick={() => router.push("/send")}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-10 h-10 rounded-xl bg-secondary text-primary flex items-center justify-center shadow-lg group-active:scale-95 transition-transform">
                <span className="material-icons-round text-lg transform -rotate-45">arrow_upward</span>
              </div>
              <span className="text-[10px] font-bold text-gray-900 dark:text-white uppercase tracking-wide">Send</span>
            </button>
            <button 
              onClick={() => router.push("/receive")}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-10 h-10 rounded-xl bg-secondary text-primary flex items-center justify-center shadow-lg group-active:scale-95 transition-transform">
                <span className="material-icons-round text-lg rotate-135" style={{ transform: 'matrix(-0.707107, 0.707107, -0.707107, -0.707107, 0, 0) rotate(45deg)' }}>arrow_downward</span>
              </div>
              <span className="text-[10px] font-bold text-gray-900 dark:text-white uppercase tracking-wide">Receive</span>
            </button>
          </div>

          <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 w-12 h-6 bg-primary rounded-b-full flex items-center justify-center shadow-sm z-20">
            <span className="material-icons-round text-secondary text-sm">keyboard_arrow_down</span>
          </div>
        </div>

        {/* Services Section */}
        <div className="mt-8">
          <h3 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-4 px-1 uppercase tracking-wider">Services</h3>
          <div className="grid grid-cols-4 gap-3">
            <ServiceButton 
              icon="currency_exchange" 
              label={"Crypto\nto Naira"} 
              useCustomIcon 
              onClick={() => handleServiceClick(services[0])}
            />
            <ServiceButton 
              icon="swap_vert" 
              label={"Naira\nto Crypto"} 
              useCustomIcon 
              onClick={() => handleServiceClick(services[1])}
            />
            <ServiceButton 
              icon="receipt_long" 
              label={"Generate\nInvoice"} 
              onClick={() => handleServiceClick(services[2])}
            />
            <ServiceButton 
              icon="trending_up" 
              label={"Create\nPrediction"} 
              onClick={() => handleServiceClick(services[3])}
            />
            <ServiceButton 
              icon="wifi" 
              label={"Buy\nData"} 
              onClick={() => handleServiceClick(services[4])}
            />
            <ServiceButton 
              icon="phone_iphone" 
              label={"Buy\nAirtime"} 
              onClick={() => handleServiceClick(services[5])}
            />
            <ServiceButton 
              icon="sports_soccer" 
              label={"Pay\nBetting"} 
              onClick={() => handleServiceClick(services[6])}
            />
            <ServiceButton 
              icon="tv" 
              label={"TV\nSub"} 
              onClick={() => handleServiceClick(services[7])}
            />
            <ServiceButton 
              icon="bolt" 
              label={"Electricity"} 
              onClick={() => handleServiceClick(services[8])}
            />
            <ServiceButton 
              icon="card_giftcard" 
              label={"Gift Card\nRedeem"} 
              onClick={() => handleServiceClick(services[9])}
            />
          </div>
        </div>

        {/* Transaction History */}
        <div className="mt-8 mb-8">
          <div className="flex justify-between items-center mb-4 px-1">
            <h3 className="text-[10px] font-bold text-background-dark dark:text-white uppercase tracking-wider">Transaction history</h3>
            <button className="text-xs text-gray-600 dark:text-white/60 font-medium hover:text-primary transition-colors">View All</button>
          </div>
          {dashboardData?.transactions && dashboardData.transactions.length > 0 ? (
            <div className="bg-white dark:bg-card-dark rounded-3xl p-4 shadow-md border border-gray-100 dark:border-white/5">
              <div className="space-y-2">
                {dashboardData.transactions.slice(0, 5).map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-white/60 dark:bg-white/5 rounded-xl p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="material-icons-outlined text-primary">receipt</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          ₦{tx.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-white/60">
                          {new Date(tx.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-1.5 justify-end">
                      {getTokenLogo("SEND") && (
                        <Image
                          src={getTokenLogo("SEND")}
                          alt="SEND"
                          width={16}
                          height={16}
                          className="rounded-full"
                          unoptimized
                        />
                      )}
                      <p className="text-xs font-semibold text-primary">
                        +{tx.sendAmount.toFixed(2)} SEND
                      </p>
                    </div>
                  </div>
                ))}
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

              <button
                onClick={() => handleCryptoOptionClick("BASE")}
                className="w-full p-4 rounded-xl bg-white/60 dark:bg-secondary/30 hover:bg-white/80 dark:hover:bg-secondary/40 border-2 border-secondary/20 hover:border-secondary/40 transition-all flex items-center justify-between group opacity-75"
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
                  <div className="flex flex-col items-start">
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">BASE</span>
                    <span className="text-xs text-gray-600 dark:text-white/60">Coming soon</span>
                  </div>
                </div>
                <span className="material-icons-outlined text-gray-600 dark:text-white/40 group-hover:text-primary transition-colors">
                  arrow_forward
                </span>
              </button>

              <button
                onClick={() => handleCryptoOptionClick("SOLANA")}
                className="w-full p-4 rounded-xl bg-white/60 dark:bg-secondary/30 hover:bg-white/80 dark:hover:bg-secondary/40 border-2 border-secondary/20 hover:border-secondary/40 transition-all flex items-center justify-between group opacity-75"
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
                  <div className="flex flex-col items-start">
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">SOLANA</span>
                    <span className="text-xs text-gray-600 dark:text-white/60">Coming soon</span>
                  </div>
                </div>
                <span className="material-icons-outlined text-gray-600 dark:text-white/40 group-hover:text-primary transition-colors">
                  arrow_forward
                </span>
              </button>
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
                className="w-full p-4 rounded-xl bg-white/60 dark:bg-secondary/30 hover:bg-white/80 dark:hover:bg-secondary/40 border-2 border-secondary/20 hover:border-secondary/40 transition-all flex items-center justify-between group opacity-75"
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
                  <div className="flex flex-col items-start">
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">SEND</span>
                    <span className="text-xs text-gray-600 dark:text-white/60">Coming soon</span>
                  </div>
                </div>
                <span className="material-icons-outlined text-gray-600 dark:text-white/40 group-hover:text-primary transition-colors">
                  arrow_forward
                </span>
              </button>

              <button
                onClick={() => handleOfframpOptionClick("BASE")}
                className="w-full p-4 rounded-xl bg-white/60 dark:bg-secondary/30 hover:bg-white/80 dark:hover:bg-secondary/40 border-2 border-secondary/20 hover:border-secondary/40 transition-all flex items-center justify-between group opacity-75"
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
                  <div className="flex flex-col items-start">
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">BASE</span>
                    <span className="text-xs text-gray-600 dark:text-white/60">Coming soon</span>
                  </div>
                </div>
                <span className="material-icons-outlined text-gray-600 dark:text-white/40 group-hover:text-primary transition-colors">
                  arrow_forward
                </span>
              </button>

              <button
                onClick={() => handleOfframpOptionClick("SOLANA")}
                className="w-full p-4 rounded-xl bg-white/60 dark:bg-secondary/30 hover:bg-white/80 dark:hover:bg-secondary/40 border-2 border-secondary/20 hover:border-secondary/40 transition-all flex items-center justify-between group opacity-75"
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
                  <div className="flex flex-col items-start">
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">SOLANA</span>
                    <span className="text-xs text-gray-600 dark:text-white/60">Coming soon</span>
                  </div>
                </div>
                <span className="material-icons-outlined text-gray-600 dark:text-white/40 group-hover:text-primary transition-colors">
                  arrow_forward
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNavigation />
    </div>
  );
}
