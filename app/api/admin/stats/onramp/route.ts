import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTotalRevenueInSEND } from "@/lib/revenue";

/**
 * Get on-ramp specific stats
 * GET /api/admin/stats/onramp
 */
export async function GET() {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Get all on-ramp transactions
    const { data: allTransactions, error } = await supabaseAdmin
      .from("transactions")
      .select("*");

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    const transactions = allTransactions || [];

    // Helper function to calculate percentage change
    const calculatePercentageChange = (current: number, previous: number): string => {
      if (previous === 0) {
        return current > 0 ? "+100%" : "0%";
      }
      const change = ((current - previous) / previous) * 100;
      const sign = change >= 0 ? "+" : "";
      return `${sign}${change.toFixed(1)}%`;
    };

    // Filter transactions by period
    const currentPeriod = transactions.filter(
      (tx) => new Date(tx.created_at) >= sevenDaysAgo
    );
    const previousPeriod = transactions.filter(
      (tx) => {
        const txDate = new Date(tx.created_at);
        return txDate >= fourteenDaysAgo && txDate < sevenDaysAgo;
      }
    );

    // Calculate current period stats
    const currentCompletedWithTokens = currentPeriod.filter(
      (tx) => tx.status === "completed" && tx.tx_hash
    );
    const currentTotalTokensDistributed = currentCompletedWithTokens.reduce((sum, tx) => {
      const sendAmount = parseFloat(tx.send_amount) || 0;
      return sum + sendAmount;
    }, 0);

    const currentCompletedTransactions = currentPeriod.filter(
      (tx) => tx.status === "completed"
    );
    const currentTotalRevenue = currentCompletedTransactions.reduce((sum, tx) => {
      return sum + parseFloat(tx.ngn_amount || "0");
    }, 0);

    const currentPending = currentPeriod.filter((tx) => tx.status === "pending").length;
    const currentSuccessful = currentCompletedTransactions.length;
    const currentFailed = currentPeriod.filter((tx) => tx.status === "failed").length;

    // Calculate previous period stats
    const previousCompletedWithTokens = previousPeriod.filter(
      (tx) => tx.status === "completed" && tx.tx_hash
    );
    const previousTotalTokensDistributed = previousCompletedWithTokens.reduce((sum, tx) => {
      const sendAmount = parseFloat(tx.send_amount) || 0;
      return sum + sendAmount;
    }, 0);

    const previousCompletedTransactions = previousPeriod.filter(
      (tx) => tx.status === "completed"
    );
    const previousTotalRevenue = previousCompletedTransactions.reduce((sum, tx) => {
      return sum + parseFloat(tx.ngn_amount || "0");
    }, 0);

    const previousPending = previousPeriod.filter((tx) => tx.status === "pending").length;
    const previousSuccessful = previousCompletedTransactions.length;
    const previousFailed = previousPeriod.filter((tx) => tx.status === "failed").length;

    // Calculate average transaction amount
    const averageTransactionAmount = currentCompletedTransactions.length > 0
      ? currentTotalRevenue / currentCompletedTransactions.length
      : 0;

    // Get total revenue in SEND
    const totalRevenueInSEND = await getTotalRevenueInSEND();

    // Calculate percentage changes
    const percentageChanges = {
      totalTransactions: calculatePercentageChange(transactions.length, previousPeriod.length),
      totalRevenue: calculatePercentageChange(currentTotalRevenue, previousTotalRevenue),
      totalTokensDistributed: calculatePercentageChange(currentTotalTokensDistributed, previousTotalTokensDistributed),
      pendingPayments: calculatePercentageChange(currentPending, previousPending),
      successfulPayments: calculatePercentageChange(currentSuccessful, previousSuccessful),
      failedPayments: calculatePercentageChange(currentFailed, previousFailed),
    };

    const stats = {
      totalTransactions: transactions.length,
      totalRevenue: currentTotalRevenue,
      totalRevenueInSEND: totalRevenueInSEND || 0,
      totalTokensDistributed: currentTotalTokensDistributed,
      pendingPayments: currentPending,
      successfulPayments: currentSuccessful,
      failedPayments: currentFailed,
      averageTransactionAmount,
      percentageChanges,
    };

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error("Error fetching on-ramp stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch on-ramp stats", details: error.message },
      { status: 500 }
    );
  }
}

