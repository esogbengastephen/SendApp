"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
} from "recharts";
import { format, subDays } from "date-fns";

interface Stats {
  totalTransactions: number;
  totalRevenue: number;
  totalTokensDistributed: number;
  pendingPayments: number;
  successfulPayments: number;
  failedPayments: number;
}

interface ChartData {
  date: string;
  revenue: number;
  transactions: number;
  tokens: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalTransactions: 0,
    totalRevenue: 0,
    totalTokensDistributed: 0,
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

  const statCards = [
    {
      title: "Total Transactions",
      value: loading ? "..." : stats.totalTransactions.toLocaleString(),
      icon: "receipt_long",
      color: "bg-blue-500",
      change: "+12.5%",
    },
    {
      title: "Total Revenue (NGN)",
      value: loading ? "..." : `₦${stats.totalRevenue.toLocaleString()}`,
      icon: "payments",
      color: "bg-green-500",
      change: "+8.2%",
    },
    {
      title: "Tokens Distributed",
      value: loading 
        ? "..." 
        : stats.totalTokensDistributed > 0 
          ? `${stats.totalTokensDistributed.toLocaleString()} SEND`
          : "0 SEND",
      icon: "account_balance_wallet",
      color: "bg-primary",
      change: stats.totalTokensDistributed > 0 ? "+15.3%" : "0%",
    },
    {
      title: "Pending Payments",
      value: loading ? "..." : stats.pendingPayments.toString(),
      icon: "schedule",
      color: "bg-yellow-500",
      change: "-3.1%",
    },
    {
      title: "Successful",
      value: loading ? "..." : stats.successfulPayments.toString(),
      icon: "check_circle",
      color: "bg-green-500",
      change: "+5.7%",
    },
    {
      title: "Failed",
      value: loading ? "..." : stats.failedPayments.toString(),
      icon: "error",
      color: "bg-red-500",
      change: "-2.4%",
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Dashboard Overview
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 sm:mt-2">
          Monitor transactions, payments, and token distributions
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
            <Link
              href="/admin/transactions"
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-icons-outlined text-primary">
                receipt_long
              </span>
              <span className="text-slate-900 dark:text-slate-100">
                View All Transactions
              </span>
            </Link>
            <Link
              href="/admin/payments"
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-icons-outlined text-primary">
                payment
              </span>
              <span className="text-slate-900 dark:text-slate-100">
                Verify Pending Payments
              </span>
            </Link>
            <Link
              href="/admin/token-distribution"
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-icons-outlined text-primary">
                account_balance_wallet
              </span>
              <span className="text-slate-900 dark:text-slate-100">
                Check Token Distribution
              </span>
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
            Recent Activity
          </h2>
          <div className="space-y-3">
            {loading ? (
              <p className="text-slate-500 dark:text-slate-400">Loading...</p>
            ) : recentActivities.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400">No recent activity</p>
            ) : (
              recentActivities.map((activity, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className={`p-2 rounded-full ${
                    activity.type === "completed" 
                      ? "bg-green-500" 
                      : activity.type === "failed"
                      ? "bg-red-500"
                      : "bg-yellow-500"
                  }`}>
                    <span className="material-icons-outlined text-white text-sm">
                      {activity.type === "completed" ? "check_circle" : activity.type === "failed" ? "error" : "schedule"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {activity.message}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {activity.time} • {activity.wallet}
                    </p>
                    {activity.txHash && (
                      <a
                        href={`https://basescan.org/tx/${activity.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline mt-1 inline-block"
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
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
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
                stroke="#34ff4d"
                strokeWidth={2}
                name="Revenue (NGN)"
                dot={{ fill: "#34ff4d", r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Transaction Volume */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
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
                fill="#34ff4d"
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

