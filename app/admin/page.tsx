"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, subDays } from "date-fns";

interface EnhancedStats {
  // User stats
  totalUsers?: number;
  
  // Total volume processed (TV): all funds processed by the app
  totalVolumeProcessed?: number;
  
  // Onramp stats
  totalTransactions: number;
  totalRevenue: number;
  totalTokensDistributed: number;
  totalRevenueInSEND?: number;
  pendingPayments: number;
  successfulPayments: number;
  failedPayments: number;
  
  // Offramp stats
  offramp?: {
    total: {
      transactions: number;
      completed: number;
      pending: number;
      failed: number;
      volume: number;
      successRate: string;
    };
    base: {
      transactions: number;
      completed: number;
      pending: number;
      failed: number;
      volume: number;
    };
    solana: {
      transactions: number;
      completed: number;
      pending: number;
      failed: number;
      volume: number;
    };
  };
  
  // Multi-chain stats
  networkBreakdown?: {
    base: {
      onramp: number;
      offramp: number;
      total: number;
    };
    solana: {
      onramp: number;
      offramp: number;
      total: number;
    };
  };
  
  // Smart wallet stats
  smartWallets?: {
    totalUsers: number;
    usersWithSmartWallets: number;
    usersWithSolanaWallets: number;
    usersWithBothWallets: number;
    smartWalletAdoptionRate: string;
    solanaWalletAdoptionRate: string;
  };
  
  // KYC stats
  kyc?: {
    tier1: number;
    tier2: number;
    tier3: number;
    total: number;
  };
  
  // Revenue breakdown
  revenueBreakdown?: {
    onramp: number;
    offramp: number;
    total: number;
  };
  
  percentageChanges?: {
    totalTransactions: string;
    totalRevenue: string;
    totalTokensDistributed: string;
    totalVolumeProcessed?: string;
    pendingPayments: string;
    successfulPayments: string;
    failedPayments: string;
    offrampTransactions?: string;
    offrampVolume?: string;
  };
}

interface ChartData {
  date: string;
  revenue: number;
  transactions: number;
  tokens: number;
}

const COLORS = {
  primary: "#00BFFF",
  backgroundDark: "#011931",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<EnhancedStats>({
    totalUsers: 0,
    totalTransactions: 0,
    totalRevenue: 0,
    totalTokensDistributed: 0,
    totalRevenueInSEND: 0,
    pendingPayments: 0,
    successfulPayments: 0,
    failedPayments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<ChartData[]>([]);
  const [transactionData, setTransactionData] = useState<ChartData[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/admin/stats");
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchChartData = async () => {
      try {
        const response = await fetch("/api/admin/charts");
        const data = await response.json();
        if (data.success) {
          setRevenueData(data.revenueData);
          setTransactionData(data.transactionData);
        }
      } catch (error) {
        console.error("Error fetching chart data:", error);
      }
    };

    const fetchRecentActivity = async () => {
      try {
        const response = await fetch("/api/admin/recent-activity");
        const data = await response.json();
        if (data.success) {
          setRecentActivities(data.activities);
        }
      } catch (error) {
        console.error("Error fetching recent activity:", error);
      }
    };

    fetchStats();
    fetchChartData();
    fetchRecentActivity();
    
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchStats();
      fetchChartData();
      fetchRecentActivity();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Prepare KYC pie chart data
  const kycChartData = stats.kyc ? [
    { name: "Tier 1", value: stats.kyc.tier1, color: COLORS.warning },
    { name: "Tier 2", value: stats.kyc.tier2, color: COLORS.info },
    { name: "Tier 3", value: stats.kyc.tier3, color: COLORS.success },
  ] : [];

  // Prepare network breakdown chart data
  const networkChartData = stats.networkBreakdown ? [
    { name: "Base", onramp: stats.networkBreakdown.base.onramp, offramp: stats.networkBreakdown.base.offramp },
    { name: "Solana", onramp: stats.networkBreakdown.solana.onramp, offramp: stats.networkBreakdown.solana.offramp },
  ] : [];

  // Prepare revenue breakdown chart data
  const revenueBreakdownData = stats.revenueBreakdown ? [
    { name: "Onramp", value: stats.revenueBreakdown.onramp || 0, color: COLORS.primary },
    { name: "Offramp", value: stats.revenueBreakdown.offramp || 0, color: COLORS.info },
  ] : [];

  const statCards = [
    {
      title: "Total Volume (TV)",
      value: loading ? "..." : `₦${(stats.totalVolumeProcessed ?? stats.revenueBreakdown?.total ?? 0).toLocaleString()}`,
      icon: "savings",
      color: "bg-primary",
      change: stats.percentageChanges?.totalVolumeProcessed ?? "0%",
      subtitle: "All funds processed (onramp + offramp)",
    },
    {
      title: "Total Users",
      value: loading ? "..." : (stats.totalUsers || 0).toLocaleString(),
      icon: "people",
      color: "bg-primary",
      change: "0%",
    },
    {
      title: "Total Onramp Transactions",
      value: loading ? "..." : (stats.totalTransactions || 0).toLocaleString(),
      icon: "receipt_long",
      color: "bg-primary",
      change: stats.percentageChanges?.totalTransactions || "0%",
    },
    {
      title: "Total Revenue (NGN)",
      value: loading ? "..." : `₦${((stats.revenueBreakdown?.total || stats.totalRevenue || 0)).toLocaleString()}`,
      icon: "payments",
      color: "bg-primary",
      change: stats.percentageChanges?.totalRevenue || "0%",
    },
    {
      title: "Total Revenue ($SEND)",
      value: loading 
        ? "..." 
        : (stats.totalRevenueInSEND || 0) > 0 
          ? `${(stats.totalRevenueInSEND || 0).toLocaleString()} $SEND`
          : "0 $SEND",
      icon: "account_balance",
      color: "bg-primary",
      change: "0%",
    },
    {
      title: "Tokens Distributed",
      value: loading 
        ? "..." 
        : (stats.totalTokensDistributed || 0) > 0 
          ? `${(stats.totalTokensDistributed || 0).toLocaleString()} $SEND`
          : "0 $SEND",
      icon: "account_balance_wallet",
      color: "bg-primary",
      change: stats.percentageChanges?.totalTokensDistributed || "0%",
    },
    {
      title: "Offramp Transactions",
      value: loading ? "..." : (stats.offramp?.total.transactions || 0).toLocaleString(),
      icon: "swap_horiz",
      color: "bg-primary",
      change: stats.percentageChanges?.offrampTransactions || "0%",
    },
    {
      title: "Offramp Volume (NGN)",
      value: loading ? "..." : `₦${((stats.offramp?.total.volume || 0)).toLocaleString()}`,
      icon: "trending_up",
      color: "bg-primary",
      change: stats.percentageChanges?.offrampVolume || "0%",
    },
    {
      title: "Smart Wallets",
      value: loading ? "..." : (stats.smartWallets?.usersWithSmartWallets || 0).toLocaleString(),
      icon: "account_balance_wallet",
      color: "bg-primary",
      change: `${stats.smartWallets?.smartWalletAdoptionRate || "0"}%`,
    },
    {
      title: "KYC Verified (Tier 2+)",
      value: loading ? "..." : ((stats.kyc?.tier2 || 0) + (stats.kyc?.tier3 || 0)).toLocaleString(),
      icon: "verified_user",
      color: "bg-primary",
      change: stats.kyc?.total ? `${(((stats.kyc.tier2 + stats.kyc.tier3) / stats.kyc.total) * 100).toFixed(1)}%` : "0%",
    },
    {
      title: "Pending Payments",
      value: loading ? "..." : (stats.pendingPayments || 0).toString(),
      icon: "schedule",
      color: "bg-warning",
      change: stats.percentageChanges?.pendingPayments || "0%",
    },
    {
      title: "Successful",
      value: loading ? "..." : (stats.successfulPayments || 0).toString(),
      icon: "check_circle",
      color: "bg-success",
      change: stats.percentageChanges?.successfulPayments || "0%",
    },
    {
      title: "Failed",
      value: loading ? "..." : (stats.failedPayments || 0).toString(),
      icon: "error",
      color: "bg-error",
      change: stats.percentageChanges?.failedPayments || "0%",
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8 min-h-screen" style={{ backgroundColor: "var(--background-light)" }}>
      <style jsx global>{`
        :root {
          --background-light: #FFFFFF;
          --background-dark: #011931;
        }
        .dark {
          --background-light: #011931;
        }
      `}</style>
      
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary dark:text-text-primary-dark">
          Dashboard Overview
        </h1>
        <p className="text-sm sm:text-base text-medium-grey dark:text-light-grey mt-1 sm:mt-2">
          Monitor transactions, payments, token distributions, and multi-chain activity
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey"
            style={{ 
              backgroundColor: "var(--card-light)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.color} p-3 rounded-lg`} style={{ backgroundColor: stat.color.includes("primary") ? COLORS.primary : stat.color.includes("success") ? COLORS.success : stat.color.includes("warning") ? COLORS.warning : COLORS.error }}>
                <span className="material-icons-outlined text-white">
                  {stat.icon}
                </span>
              </div>
              <span
                className={`text-sm font-medium ${
                  stat.change.startsWith("+")
                    ? "text-success dark:text-success"
                    : stat.change === "0%" || stat.change.includes("%") && !stat.change.startsWith("-")
                    ? "text-medium-grey dark:text-light-grey"
                    : "text-error dark:text-error"
                }`}
                style={{
                  color: stat.change.startsWith("+") ? COLORS.success : stat.change.startsWith("-") ? COLORS.error : undefined
                }}
              >
                {stat.change}
              </span>
            </div>
            <h3 className="text-xs sm:text-sm font-medium text-medium-grey dark:text-light-grey mb-1">
              {stat.title}
            </h3>
            {"subtitle" in stat && stat.subtitle && (
              <p className="text-xs text-medium-grey dark:text-light-grey mb-1">
                {stat.subtitle}
              </p>
            )}
            <p className="text-xl sm:text-2xl font-bold text-text-primary dark:text-text-primary-dark">
              {loading ? "..." : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Network Breakdown Section */}
      {stats.offramp && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
            <h2 className="text-lg sm:text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
              Base Network
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-medium-grey dark:text-light-grey">Transactions</p>
                <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                  {stats.offramp.base.transactions.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-medium-grey dark:text-light-grey">Volume</p>
                <p className="text-xl font-bold text-primary">₦{stats.offramp.base.volume.toLocaleString()}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-medium-grey dark:text-light-grey">Completed</p>
                  <p className="text-lg font-semibold text-success">{stats.offramp.base.completed}</p>
                </div>
                <div>
                  <p className="text-xs text-medium-grey dark:text-light-grey">Pending</p>
                  <p className="text-lg font-semibold text-warning">{stats.offramp.base.pending}</p>
                </div>
                <div>
                  <p className="text-xs text-medium-grey dark:text-light-grey">Failed</p>
                  <p className="text-lg font-semibold text-error">{stats.offramp.base.failed}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
            <h2 className="text-lg sm:text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
              Solana Network
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-medium-grey dark:text-light-grey">Transactions</p>
                <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                  {stats.offramp.solana.transactions.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-medium-grey dark:text-light-grey">Volume</p>
                <p className="text-xl font-bold text-primary">₦{stats.offramp.solana.volume.toLocaleString()}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-medium-grey dark:text-light-grey">Completed</p>
                  <p className="text-lg font-semibold text-success">{stats.offramp.solana.completed}</p>
                </div>
                <div>
                  <p className="text-xs text-medium-grey dark:text-light-grey">Pending</p>
                  <p className="text-lg font-semibold text-warning">{stats.offramp.solana.pending}</p>
                </div>
                <div>
                  <p className="text-xs text-medium-grey dark:text-light-grey">Failed</p>
                  <p className="text-lg font-semibold text-error">{stats.offramp.solana.failed}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
            <h2 className="text-lg sm:text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
              Offramp Summary
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-medium-grey dark:text-light-grey">Total Transactions</p>
                <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                  {stats.offramp.total.transactions.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-medium-grey dark:text-light-grey">Total Volume</p>
                <p className="text-xl font-bold text-primary">₦{stats.offramp.total.volume.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-medium-grey dark:text-light-grey">Success Rate</p>
                <p className="text-xl font-bold text-success">{stats.offramp.total.successRate}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Smart Wallet & KYC Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {stats.smartWallets && (
          <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
            <h2 className="text-lg sm:text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
              Smart Wallet Adoption
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-medium-grey dark:text-light-grey">Base Wallets</p>
                  <p className="text-2xl font-bold text-primary">{stats.smartWallets.usersWithSmartWallets.toLocaleString()}</p>
                  <p className="text-xs text-medium-grey dark:text-light-grey mt-1">
                    {stats.smartWallets.smartWalletAdoptionRate}% adoption
                  </p>
                </div>
                <div>
                  <p className="text-sm text-medium-grey dark:text-light-grey">Solana Wallets</p>
                  <p className="text-2xl font-bold text-primary">{stats.smartWallets.usersWithSolanaWallets.toLocaleString()}</p>
                  <p className="text-xs text-medium-grey dark:text-light-grey mt-1">
                    {stats.smartWallets.solanaWalletAdoptionRate}% adoption
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-medium-grey dark:text-light-grey">Users with Both</p>
                <p className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                  {stats.smartWallets.usersWithBothWallets.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-medium-grey dark:text-light-grey">Total Users</p>
                <p className="text-lg font-semibold text-text-primary dark:text-text-primary-dark">
                  {stats.smartWallets.totalUsers.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {stats.kyc && (
          <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
            <h2 className="text-lg sm:text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
              KYC Tier Distribution
            </h2>
            <div className="space-y-4">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={kycChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {kycChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-xs text-medium-grey dark:text-light-grey">Tier 1</p>
                  <p className="text-lg font-bold text-warning">{stats.kyc.tier1}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-medium-grey dark:text-light-grey">Tier 2</p>
                  <p className="text-lg font-bold text-info">{stats.kyc.tier2}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-medium-grey dark:text-light-grey">Tier 3</p>
                  <p className="text-lg font-bold text-success">{stats.kyc.tier3}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Revenue Breakdown */}
      {stats.revenueBreakdown && (
        <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
          <h2 className="text-lg sm:text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
            Revenue Breakdown by Service Type
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueBreakdownData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {revenueBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `₦${value.toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-medium-grey dark:text-light-grey">Onramp Revenue</p>
                <p className="text-2xl font-bold text-primary">₦{(stats.revenueBreakdown?.onramp || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-medium-grey dark:text-light-grey">Offramp Revenue</p>
                <p className="text-2xl font-bold text-primary">₦{(stats.revenueBreakdown?.offramp || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-medium-grey dark:text-light-grey">Total Revenue</p>
                <p className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">
                  ₦{(stats.revenueBreakdown?.total || stats.totalRevenue || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Network Breakdown Chart */}
      {networkChartData.length > 0 && (
        <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
          <h2 className="text-lg sm:text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
            Network Revenue Breakdown
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={networkChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" tickFormatter={(value) => `₦${(value / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number) => `₦${value.toLocaleString()}`}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar dataKey="onramp" fill={COLORS.primary} name="Onramp" radius={[8, 8, 0, 0]} />
              <Bar dataKey="offramp" fill={COLORS.info} name="Offramp" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
          <h2 className="text-lg sm:text-xl font-bold text-text-primary dark:text-text-primary-dark mb-3 sm:mb-4">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <Link
              href="/admin/onramp"
              className="flex items-center gap-3 p-3 rounded-lg bg-light-blue dark:bg-background-dark hover:opacity-80 transition-opacity"
            >
              <span className="material-icons-outlined" style={{ color: COLORS.primary }}>
                arrow_downward
              </span>
              <span className="text-text-primary dark:text-text-primary-dark">Onramp Transactions</span>
            </Link>
            <Link
              href="/admin/offramp"
              className="flex items-center gap-3 p-3 rounded-lg bg-light-blue dark:bg-background-dark hover:opacity-80 transition-opacity"
            >
              <span className="material-icons-outlined" style={{ color: COLORS.primary }}>
                arrow_upward
              </span>
              <span className="text-text-primary dark:text-text-primary-dark">Offramp Transactions</span>
            </Link>
            <Link
              href="/admin/transactions"
              className="flex items-center gap-3 p-3 rounded-lg bg-light-blue dark:bg-background-dark hover:opacity-80 transition-opacity"
            >
              <span className="material-icons-outlined" style={{ color: COLORS.primary }}>
                receipt_long
              </span>
              <span className="text-text-primary dark:text-text-primary-dark">View All Transactions</span>
            </Link>
            <Link
              href="/admin/kyc"
              className="flex items-center gap-3 p-3 rounded-lg bg-light-blue dark:bg-background-dark hover:opacity-80 transition-opacity"
            >
              <span className="material-icons-outlined" style={{ color: COLORS.primary }}>
                verified_user
              </span>
              <span className="text-text-primary dark:text-text-primary-dark">KYC Management</span>
            </Link>
            <Link
              href="/admin/payments"
              className="flex items-center gap-3 p-3 rounded-lg bg-light-blue dark:bg-background-dark hover:opacity-80 transition-opacity"
            >
              <span className="material-icons-outlined" style={{ color: COLORS.primary }}>
                payment
              </span>
              <span className="text-text-primary dark:text-text-primary-dark">Verify Pending Payments</span>
            </Link>
            <Link
              href="/admin/invoices"
              className="flex items-center gap-3 p-3 rounded-lg bg-light-blue dark:bg-background-dark hover:opacity-80 transition-opacity"
            >
              <span className="material-icons-outlined" style={{ color: COLORS.primary }}>
                description
              </span>
              <span className="text-text-primary dark:text-text-primary-dark">View Invoices</span>
            </Link>
          </div>
        </div>

        <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
          <h2 className="text-lg sm:text-xl font-bold text-text-primary dark:text-text-primary-dark mb-3 sm:mb-4">
            Recent Activity
          </h2>
          <div className="space-y-3">
            {loading ? (
              <p className="text-medium-grey dark:text-light-grey">Loading...</p>
            ) : recentActivities.length === 0 ? (
              <p className="text-medium-grey dark:text-light-grey">No recent activity</p>
            ) : (
              recentActivities.map((activity, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-light-blue dark:bg-background-dark hover:opacity-80 transition-opacity"
                >
                  <div className={`p-2 rounded-full ${
                    activity.type === "completed" 
                      ? "bg-success" 
                      : activity.type === "failed"
                      ? "bg-error"
                      : "bg-warning"
                  }`}>
                    <span className="material-icons-outlined text-white text-sm">
                      {activity.type === "completed" ? "check_circle" : activity.type === "failed" ? "error" : "schedule"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                      {activity.message}
                    </p>
                    <p className="text-xs text-medium-grey dark:text-light-grey mt-1">
                      {activity.time} • {activity.wallet}
                    </p>
                    {activity.txHash && (
                      <a
                        href={`https://basescan.org/tx/${activity.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs hover:underline mt-1 inline-block"
                        style={{ color: COLORS.primary }}
                      >
                        View on Basescan →
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Revenue Trends */}
        <div className="bg-card-light dark:bg-card-dark p-4 sm:p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
          <h2 className="text-lg sm:text-xl font-bold text-text-primary dark:text-text-primary-dark mb-3 sm:mb-4">
            Revenue Trends (Last 30 Days)
          </h2>
          <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                style={{ fontSize: "12px" }}
              />
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
                formatter={(value: number) => [`₦${value.toLocaleString()}`, "Revenue"]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke={COLORS.primary}
                strokeWidth={2}
                name="Revenue (NGN)"
                dot={{ fill: COLORS.primary, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Transaction Volume */}
        <div className="bg-card-light dark:bg-card-dark p-6 rounded-xl shadow-lg border border-light-grey dark:border-medium-grey">
          <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
            Transaction Volume (Last 30 Days)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={transactionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                style={{ fontSize: "12px" }}
              />
              <YAxis
                stroke="#64748b"
                style={{ fontSize: "12px" }}
              />
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
                fill={COLORS.primary}
                name="Transactions"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
