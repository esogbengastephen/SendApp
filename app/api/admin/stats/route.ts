import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTotalRevenueInSEND } from "@/lib/revenue";

export async function GET() {
  try {
    console.log("[Stats API] Starting stats fetch...");
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Query all transactions from Supabase
    console.log("[Stats API] Querying transactions...");
    const { data: allTransactions, error } = await supabaseAdmin
      .from("transactions")
      .select("*");

    if (error) {
      console.error("[Stats API] Supabase error:", error);
      return NextResponse.json(
        { success: false, error: "Database error", details: error.message },
        { status: 500 }
      );
    }

    console.log(`[Stats API] Fetched ${allTransactions?.length || 0} transactions`);

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

    // Calculate all-time totals
    const allTimeCompletedWithTokens = transactions.filter(
      (tx) => tx.status === "completed" && tx.tx_hash
    );
    const allTimeTotalTokensDistributed = allTimeCompletedWithTokens.reduce((sum, tx) => {
      const sendAmount = parseFloat(tx.send_amount) || 0;
      return sum + sendAmount;
    }, 0);

    const allTimeCompletedTransactions = transactions.filter(
      (tx) => tx.status === "completed"
    );
    const allTimeTotalRevenue = allTimeCompletedTransactions.reduce((sum, tx) => {
      return sum + parseFloat(tx.ngn_amount || "0");
    }, 0);

    // Calculate percentage changes (last 7 days vs previous 7 days)
    const percentageChanges = {
      totalTransactions: calculatePercentageChange(
        currentPeriod.length,
        previousPeriod.length
      ),
      totalRevenue: calculatePercentageChange(
        currentTotalRevenue,
        previousTotalRevenue
      ),
      totalTokensDistributed: calculatePercentageChange(
        currentTotalTokensDistributed,
        previousTotalTokensDistributed
      ),
      pendingPayments: calculatePercentageChange(
        currentPeriod.filter((tx) => tx.status === "pending").length,
        previousPeriod.filter((tx) => tx.status === "pending").length
      ),
      successfulPayments: calculatePercentageChange(
        currentCompletedTransactions.length,
        previousCompletedTransactions.length
      ),
      failedPayments: calculatePercentageChange(
        currentPeriod.filter((tx) => tx.status === "failed").length,
        previousPeriod.filter((tx) => tx.status === "failed").length
      ),
    };

    // Calculate total revenue in $SEND from revenue table
    let totalRevenueInSEND = 0;
    try {
      totalRevenueInSEND = await getTotalRevenueInSEND();
    } catch (revenueError) {
      console.error("Error fetching total revenue in SEND:", revenueError);
      // Continue with 0 if revenue fetch fails
    }

    // Calculate stats (all-time totals)
    const stats = {
      totalTransactions: transactions.length,
      totalRevenue: allTimeTotalRevenue,
      totalTokensDistributed: allTimeTotalTokensDistributed,
      totalRevenueInSEND, // Add revenue in $SEND
      pendingPayments: transactions.filter((tx) => tx.status === "pending").length,
      successfulPayments: allTimeCompletedTransactions.length,
      failedPayments: transactions.filter((tx) => tx.status === "failed").length,
      percentageChanges, // Add percentage changes
    };

    console.log("[Stats] Dashboard stats:", {
      total: stats.totalTransactions,
      completed: stats.successfulPayments,
      tokens: `${stats.totalTokensDistributed.toLocaleString()} $SEND`,
      revenue: `₦${stats.totalRevenue.toLocaleString()}`,
      changes: percentageChanges,
    });

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats", details: error.message },
      { status: 500 }
    );
  }
}

