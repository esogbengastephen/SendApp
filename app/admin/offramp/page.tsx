"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface OffRampStats {
  totalTransactions: number;
  totalUSDC: number;
  totalNGNPaid: number;
  totalFees: number;
  pendingSwaps: number;
  completedSwaps: number;
  failedSwaps: number;
  averageSwapAmount: number;
  percentageChanges: {
    totalTransactions: string;
    totalUSDC: string;
    totalNGNPaid: string;
    totalFees: string;
    pendingSwaps: string;
    completedSwaps: string;
    failedSwaps: string;
  };
}

interface ChartData {
  date: string;
  usdc: number;
  ngn: number;
  transactions: number;
  fees: number;
}

interface OffRampTransaction {
  id: string;
  transaction_id: string;
  user_email: string;
  user_account_number: string;
  unique_wallet_address: string;
  token_symbol: string;
  token_amount: string;
  usdc_amount: string;
  ngn_amount: number;
  status: string;
  swap_tx_hash: string | null;
  paystack_reference: string | null;
  error_message: string | null;
  created_at: string;
  token_received_at: string | null;
  usdc_received_at: string | null;
  paid_at: string | null;
}

const COLORS = ["#22c55e", "#eab308", "#ef4444", "#8b5cf6"];

export default function OffRampPage() {
  const { address } = useAccount();
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<"main" | "onramp" | "offramp">("offramp");
  const [stats, setStats] = useState<OffRampStats | null>(null);
  const [transactions, setTransactions] = useState<OffRampTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<OffRampTransaction[]>([]);
  const [usdcData, setUsdcData] = useState<ChartData[]>([]);
  const [ngnData, setNgnData] = useState<ChartData[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "token_received" | "swapping" | "usdc_received" | "completed" | "failed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<OffRampTransaction | null>(null);

  useEffect(() => {
    if (pathname === "/admin/offramp") {
      setActiveTab("offramp");
    }
  }, [pathname]);

  useEffect(() => {
    if (!address) return;

    const fetchData = async () => {
      try {
        // Fetch off-ramp stats
        const statsResponse = await fetch("/api/admin/stats/offramp");
        const statsData = await statsResponse.json();
        if (statsData.success) {
          setStats(statsData.stats);
        }

        // Fetch off-ramp transactions
        const url = filter === "all" 
          ? `/api/admin/offramp?adminWallet=${address}` 
          : `/api/admin/offramp?adminWallet=${address}&status=${filter}`;
        const txResponse = await fetch(url);
        const txData = await txResponse.json();
        if (txData.success) {
          setTransactions(txData.transactions || []);
        }

        // Fetch chart data
        const chartsResponse = await fetch("/api/admin/charts/offramp");
        const chartsData = await chartsResponse.json();
        if (chartsData.success) {
          setUsdcData(chartsData.usdcData || []);
          setNgnData(chartsData.ngnData || []);
          setStatusDistribution(chartsData.statusDistribution || null);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [address, filter]);

  // Apply search filter
  useEffect(() => {
    let filtered = [...transactions];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.transaction_id.toLowerCase().includes(query) ||
          tx.user_email.toLowerCase().includes(query) ||
          tx.user_account_number.includes(query) ||
          tx.unique_wallet_address.toLowerCase().includes(query)
      );
    }

    setFilteredTransactions(filtered);
  }, [transactions, searchQuery]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400",
      token_received: "bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400",
      swapping: "bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-400",
      usdc_received: "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400",
      paying: "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400",
      completed: "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400",
      failed: "bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400",
      refunded: "bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-400",
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-400"}`}
      >
        {status.replace(/_/g, " ").toUpperCase()}
      </span>
    );
  };

  const statCards = stats
    ? [
        {
          title: "Total Off-Ramp Transactions",
          value: stats.totalTransactions.toLocaleString(),
          icon: "receipt_long",
          color: "bg-blue-500",
          change: stats.percentageChanges.totalTransactions,
        },
        {
          title: "Total USDC Swapped",
          value: `${stats.totalUSDC.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`,
          icon: "swap_horiz",
          color: "bg-purple-500",
          change: stats.percentageChanges.totalUSDC,
        },
        {
          title: "Total NGN Paid Out",
          value: `₦${stats.totalNGNPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
          icon: "payments",
          color: "bg-green-500",
          change: stats.percentageChanges.totalNGNPaid,
        },
        {
          title: "Total Fees Collected",
          value: `₦${stats.totalFees.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
          icon: "account_balance",
          color: "bg-indigo-500",
          change: stats.percentageChanges.totalFees,
        },
        {
          title: "Pending Swaps",
          value: stats.pendingSwaps.toString(),
          icon: "schedule",
          color: "bg-yellow-500",
          change: stats.percentageChanges.pendingSwaps,
        },
        {
          title: "Completed Swaps",
          value: stats.completedSwaps.toString(),
          icon: "check_circle",
          color: "bg-green-500",
          change: stats.percentageChanges.completedSwaps,
        },
        {
          title: "Failed Swaps",
          value: stats.failedSwaps.toString(),
          icon: "error",
          color: "bg-red-500",
          change: stats.percentageChanges.failedSwaps,
        },
        {
          title: "Average Swap Amount",
          value: `${stats.averageSwapAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`,
          icon: "trending_up",
          color: "bg-cyan-500",
          change: "0%",
        },
      ]
    : [];

  const statusData = statusDistribution
    ? [
        { name: "Completed", value: statusDistribution.completed, color: "#22c55e" },
        { name: "Pending", value: statusDistribution.pending, color: "#eab308" },
        { name: "Failed", value: statusDistribution.failed, color: "#ef4444" },
        { name: "Refunded", value: statusDistribution.refunded || 0, color: "#8b5cf6" },
      ].filter((item) => item.value > 0)
    : [];

  const handleContinue = async (transactionId: string, currentStatus: string) => {
    if (!address) return;
    
    try {
      let endpoint = "";
      let action = "";
      
      if (currentStatus === "token_received" || currentStatus === "swapping") {
        endpoint = `/api/offramp/swap-token`;
        action = "swap";
      } else if (currentStatus === "usdc_received") {
        endpoint = `/api/offramp/process-payment`;
        action = "payment";
      } else {
        alert("Cannot continue from this status");
        return;
      }
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
      });
      
      const data = await response.json();
      if (data.success) {
        alert(`${action === "swap" ? "Swap" : "Payment"} ${action === "swap" ? "triggered" : "initiated"} successfully!`);
        window.location.reload();
      } else {
        alert(`Error: ${data.message || data.error}`);
      }
    } catch (error) {
      console.error("Error continuing transaction:", error);
      alert("Failed to continue transaction");
    }
  };

  const handleRetry = async (transactionId: string) => {
    if (!address) return;
    
    try {
      const response = await fetch(`/api/admin/offramp/${transactionId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminWallet: address }),
      });
      
      const data = await response.json();
      if (data.success) {
        alert("Retry initiated successfully");
        window.location.reload();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error retrying transaction:", error);
      alert("Failed to retry transaction");
    }
  };

  const handleRefund = async (transactionId: string) => {
    if (!address) return;
    
    const refundAddress = prompt("Enter wallet address to refund to:");
    if (!refundAddress) return;
    
    try {
      const response = await fetch(`/api/admin/offramp/${transactionId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminWallet: address, refundToAddress: refundAddress }),
      });
      
      const data = await response.json();
      if (data.success) {
        alert(`Refund successful! TX: ${data.refundTxHash}`);
        window.location.reload();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error refunding transaction:", error);
      alert("Failed to refund transaction");
    }
  };

  const handleRecoverUSDC = async (transactionId: string, walletAddress: string) => {
    if (!address) return;
    
    if (!confirm(`Recover USDC from wallet ${walletAddress}?\n\nThis will transfer any USDC in the unique wallet to the receiver wallet.`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/offramp/recover-usdc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          adminWallet: address, 
          transactionId,
          walletAddress 
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        alert(`USDC recovered successfully!\n\nAmount: ${data.usdcAmount} USDC\nTransfer TX: ${data.transferTxHash}\nReceiver: ${data.receiverWallet}`);
        window.location.reload();
      } else {
        alert(`Error: ${data.error || "Failed to recover USDC"}`);
      }
    } catch (error) {
      console.error("Error recovering USDC:", error);
      alert("Failed to recover USDC");
    }
  };

  const handleManualSwap = async (transactionId: string, walletAddress: string) => {
    if (!address) return;
    
    if (!confirm(`Manually trigger swap for wallet ${walletAddress}?\n\nThis will:\n1. Set token info from BaseScan data\n2. Trigger swap to USDC\n3. Transfer USDC to receiver wallet\n\nContinue?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/offramp/manual-swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          adminWallet: address, 
          walletAddress,
          transactionId
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        alert(`✅ Manual swap triggered successfully!\n\nTransaction ID: ${data.transactionId}\nWallet: ${data.walletAddress}\n\nCheck the swap progress in the transaction details.`);
        window.location.reload();
      } else {
        alert(`Error: ${data.error || "Failed to trigger manual swap"}`);
      }
    } catch (error) {
      console.error("Error triggering manual swap:", error);
      alert("Failed to trigger manual swap");
    }
  };

  const handleRestart = async (transactionId: string, walletAddress: string) => {
    if (!address) return;
    
    if (!confirm(`Restart and Execute Swap for wallet ${walletAddress}?\n\nThis will:\n1. Check for tokens in wallet (or use existing)\n2. Fund wallet with gas from master wallet\n3. Swap tokens to USDC\n4. Transfer USDC to receiver wallet\n5. Return remaining ETH to master wallet\n\nContinue?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/offramp/restart-by-wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          adminWallet: address,
          walletAddress: walletAddress
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        alert(`✅ Restart and Swap Completed!\n\nTransaction ID: ${data.transactionId}\nWallet: ${data.walletAddress}\nSwap TX: ${data.swapTxHash || "Processing..."}\nUSDC Amount: ${data.usdcAmount || "Calculating..."}\n\n${data.details || ""}`);
        window.location.reload();
      } else {
        alert(`Error: ${data.error || "Failed to restart transaction"}\n\n${data.hint || ""}\n${data.swapError || ""}`);
      }
    } catch (error) {
      console.error("Error restarting transaction:", error);
      alert("Failed to restart transaction");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header with Tabs */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Off-Ramp Dashboard
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 sm:mt-2">
          Monitor token-to-Naira conversions, swaps, and payments
        </p>

        {/* Tabs */}
        <div className="flex justify-center mt-6">
          <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => router.push("/admin")}
              className="px-6 py-2 rounded-md font-medium transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              Main
            </button>
            <button
              onClick={() => router.push("/admin/onramp")}
              className="px-6 py-2 rounded-md font-medium transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              On-Ramp
            </button>
            <button
              onClick={() => router.push("/admin/offramp")}
              className="px-6 py-2 rounded-md font-medium transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
            >
              Off-Ramp
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.color} p-3 rounded-lg`}>
                <span className="material-icons-outlined text-white">
                  {stat.icon}
                </span>
              </div>
              <span
                className={`text-sm font-medium ${
                  stat.change.startsWith("+")
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {stat.change}
              </span>
            </div>
            <h3 className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              {stat.title}
            </h3>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              {loading ? "..." : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <button
              onClick={() => {
                const pendingTxs = transactions.filter(tx => 
                  tx.status === "pending" || tx.status === "token_received" || tx.status === "swapping"
                );
                if (pendingTxs.length > 0) {
                  alert(`Found ${pendingTxs.length} pending swaps. Check the transaction list below.`);
                } else {
                  alert("No pending swaps found.");
                }
              }}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-left"
            >
              <span className="material-icons-outlined text-primary">swap_horiz</span>
              <span className="text-slate-900 dark:text-slate-100">Monitor Swaps</span>
            </button>
            <button
              onClick={() => {
                const stuckTxs = transactions.filter(tx => 
                  (tx.status === "swapping" || tx.status === "usdc_received") && !tx.swap_tx_hash
                );
                if (stuckTxs.length > 0) {
                  alert(`Found ${stuckTxs.length} transactions that may need USDC recovery. Check the transaction list.`);
                } else {
                  alert("No stuck transactions found.");
                }
              }}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-left"
            >
              <span className="material-icons-outlined text-primary">account_balance_wallet</span>
              <span className="text-slate-900 dark:text-slate-100">Recover USDC</span>
            </button>
            <Link
              href="/admin/offramp"
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-icons-outlined text-primary">receipt_long</span>
              <span className="text-slate-900 dark:text-slate-100">View All Transactions</span>
            </Link>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
            Status Distribution
          </h2>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 text-center py-8">No data available</p>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* USDC Swapped Trends */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
            USDC Swapped (Last 30 Days)
          </h2>
          <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
            <LineChart data={usdcData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: "12px" }} />
              <YAxis
                stroke="#64748b"
                style={{ fontSize: "12px" }}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [`${value.toLocaleString()} USDC`, "USDC"]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="usdc"
                stroke="#8b5cf6"
                strokeWidth={2}
                name="USDC Swapped"
                dot={{ fill: "#8b5cf6", r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* NGN Paid Out */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
            NGN Paid Out (Last 30 Days)
          </h2>
          <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
            <LineChart data={ngnData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: "12px" }} />
              <YAxis
                stroke="#64748b"
                style={{ fontSize: "12px" }}
                tickFormatter={(value) => `₦${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [`₦${value.toLocaleString()}`, "NGN"]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="ngn"
                stroke="#34ff4d"
                strokeWidth={2}
                name="NGN Paid"
                dot={{ fill: "#34ff4d", r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transaction Volume Chart */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
          Transaction Volume (Last 30 Days)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={usdcData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: "12px" }} />
            <YAxis stroke="#64748b" style={{ fontSize: "12px" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
              }}
              formatter={(value: number) => [value, "Transactions"]}
            />
            <Legend />
            <Bar
              dataKey="transactions"
              fill="#3b82f6"
              name="Transactions"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">Filters</h2>
        
        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Status
          </label>
          <div className="flex flex-wrap gap-2">
            {(["all", "pending", "token_received", "swapping", "usdc_received", "completed", "failed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === f
                    ? "bg-primary text-slate-900"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {f.replace(/_/g, " ").charAt(0).toUpperCase() + f.replace(/_/g, " ").slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Search
          </label>
          <input
            type="text"
            placeholder="Search by Transaction ID, Email, Account Number, or Wallet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Transaction ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Token</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">USDC Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amount (NGN)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    Loading transactions...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-4 py-3 text-sm font-mono text-slate-900 dark:text-slate-100">
                      {tx.transaction_id.slice(0, 20)}...
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      <div>{tx.user_email}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{tx.user_account_number}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      {tx.token_symbol || "N/A"} {tx.token_amount ? `(${parseFloat(tx.token_amount).toFixed(4)})` : ""}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      {tx.usdc_amount ? `${parseFloat(tx.usdc_amount).toFixed(2)} USDC` : "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      {tx.ngn_amount ? `₦${tx.ngn_amount.toFixed(2)}` : "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {getStatusBadge(tx.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {format(new Date(tx.created_at), "MMM dd, yyyy HH:mm")}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setSelectedTransaction(tx)}
                          className="text-primary hover:underline"
                        >
                          View
                        </button>
                        
                        {(tx.status === "swapping" || tx.status === "token_received" || tx.status === "usdc_received") && (
                          <button
                            onClick={() => handleContinue(tx.transaction_id, tx.status)}
                            className="text-green-600 dark:text-green-400 hover:underline"
                          >
                            Continue
                          </button>
                        )}
                        
                        {tx.status === "failed" && (
                          <button
                            onClick={() => handleRetry(tx.transaction_id)}
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Retry
                          </button>
                        )}
                        
                        {tx.status !== "completed" && (
                          <button
                            onClick={() => handleRestart(tx.transaction_id, tx.unique_wallet_address)}
                            className="text-yellow-600 dark:text-yellow-400 hover:underline"
                            title="Restart and execute full swap: fund gas → swap → transfer USDC → return ETH"
                          >
                            Restart & Swap
                          </button>
                        )}
                        
                        {(tx.status === "failed" || tx.status === "token_received") && (
                          <button
                            onClick={() => handleRefund(tx.transaction_id)}
                            className="text-red-600 dark:text-red-400 hover:underline"
                          >
                            Refund
                          </button>
                        )}
                        
                        {(tx.status === "swapping" || tx.status === "token_received" || tx.status === "usdc_received") && (
                          <button
                            onClick={() => handleRecoverUSDC(tx.transaction_id, tx.unique_wallet_address)}
                            className="text-orange-600 dark:text-orange-400 hover:underline"
                            title="Recover USDC from unique wallet"
                          >
                            Recover USDC
                          </button>
                        )}
                        
                        {(tx.status === "pending" || (tx.status === "token_received" && !tx.swap_tx_hash)) && (
                          <button
                            onClick={() => handleManualSwap(tx.transaction_id, tx.unique_wallet_address)}
                            className="text-purple-600 dark:text-purple-400 hover:underline"
                            title="Manually trigger swap (useful if RPC is out of sync)"
                          >
                            Manual Swap
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Transaction Details
                </h2>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <span className="material-icons-outlined">close</span>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Transaction ID</label>
                  <p className="text-slate-900 dark:text-slate-100 font-mono">{selectedTransaction.transaction_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">User Email</label>
                  <p className="text-slate-900 dark:text-slate-100">{selectedTransaction.user_email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Account Number</label>
                  <p className="text-slate-900 dark:text-slate-100">{selectedTransaction.user_account_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Wallet Address</label>
                  <p className="text-slate-900 dark:text-slate-100 font-mono text-sm">{selectedTransaction.unique_wallet_address}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Token</label>
                  <p className="text-slate-900 dark:text-slate-100">
                    {selectedTransaction.token_symbol || "N/A"} {selectedTransaction.token_amount ? `(${parseFloat(selectedTransaction.token_amount).toFixed(4)})` : ""}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">USDC Amount</label>
                  <p className="text-slate-900 dark:text-slate-100">
                    {selectedTransaction.usdc_amount ? `${parseFloat(selectedTransaction.usdc_amount).toFixed(2)} USDC` : "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">NGN Amount</label>
                  <p className="text-slate-900 dark:text-slate-100">
                    {selectedTransaction.ngn_amount ? `₦${selectedTransaction.ngn_amount.toFixed(2)}` : "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedTransaction.status)}</div>
                </div>
                {selectedTransaction.swap_tx_hash && (
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Swap TX Hash</label>
                    <a
                      href={`https://basescan.org/tx/${selectedTransaction.swap_tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-mono text-sm block"
                    >
                      {selectedTransaction.swap_tx_hash}
                    </a>
                  </div>
                )}
                {selectedTransaction.paystack_reference && (
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Paystack Reference</label>
                    <p className="text-slate-900 dark:text-slate-100 font-mono text-sm">{selectedTransaction.paystack_reference}</p>
                  </div>
                )}
                {selectedTransaction.error_message && (
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Error Message</label>
                    <p className="text-red-600 dark:text-red-400 text-sm">{selectedTransaction.error_message}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Created At</label>
                  <p className="text-slate-900 dark:text-slate-100">{format(new Date(selectedTransaction.created_at), "MMM dd, yyyy HH:mm:ss")}</p>
                </div>
              </div>

              <div className="mt-6 flex gap-2 flex-wrap">
                {selectedTransaction.status !== "completed" && (
                  <button
                    onClick={() => {
                      handleRestart(selectedTransaction.transaction_id, selectedTransaction.unique_wallet_address);
                      setSelectedTransaction(null);
                    }}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors"
                    title="Restart and execute full swap: fund gas → swap → transfer USDC → return ETH"
                  >
                    Restart & Execute Swap
                  </button>
                )}
                
                {(selectedTransaction.status === "failed" || selectedTransaction.status === "token_received") && (
                  <button
                    onClick={() => {
                      handleRefund(selectedTransaction.transaction_id);
                      setSelectedTransaction(null);
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Refund
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
