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
        // Generate mock chart data for last 30 days
        const days = 30;
        const revenueChart: ChartData[] = [];
        const transactionChart: ChartData[] = [];

        for (let i = days - 1; i >= 0; i--) {
          const date = subDays(new Date(), i);
          const dateStr = format(date, "MMM dd");
          
          // Mock data - in production, fetch from API
          revenueChart.push({
            date: dateStr,
            revenue: Math.floor(Math.random() * 50000) + 10000,
            transactions: 0,
            tokens: 0,
          });

          transactionChart.push({
            date: dateStr,
            revenue: 0,
            transactions: Math.floor(Math.random() * 50) + 10,
            tokens: 0,
          });
        }

        setRevenueData(revenueChart);
        setTransactionData(transactionChart);
      } catch (error) {
        console.error("Error fetching chart data:", error);
      }
    };

    fetchStats();
    fetchChartData();
  }, []);

  const statCards = [
    {
      title: "Total Transactions",
      value: stats.totalTransactions.toLocaleString(),
      icon: "receipt_long",
      color: "bg-blue-500",
      change: "+12.5%",
    },
    {
      title: "Total Revenue (NGN)",
      value: `₦${stats.totalRevenue.toLocaleString()}`,
      icon: "payments",
      color: "bg-green-500",
      change: "+8.2%",
    },
    {
      title: "Tokens Distributed",
      value: `${stats.totalTokensDistributed.toLocaleString()} SEND`,
      icon: "account_balance_wallet",
      color: "bg-primary",
      change: "+15.3%",
    },
    {
      title: "Pending Payments",
      value: stats.pendingPayments.toString(),
      icon: "schedule",
      color: "bg-yellow-500",
      change: "-3.1%",
    },
    {
      title: "Successful",
      value: stats.successfulPayments.toString(),
      icon: "check_circle",
      color: "bg-green-500",
      change: "+5.7%",
    },
    {
      title: "Failed",
      value: stats.failedPayments.toString(),
      icon: "error",
      color: "bg-red-500",
      change: "-2.4%",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Dashboard Overview
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Monitor transactions, payments, and token distributions
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700"
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
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              {stat.title}
            </h3>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {loading ? "..." : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
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

        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Recent Activity
          </h2>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800"
              >
                <div className="bg-primary p-2 rounded-full">
                  <span className="material-icons-outlined text-slate-900 text-sm">
                    check
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Transaction #{1234 + i} completed
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    2 minutes ago
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trends */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Revenue Trends (Last 30 Days)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
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

