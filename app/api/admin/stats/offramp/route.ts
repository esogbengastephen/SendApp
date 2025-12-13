import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Get off-ramp specific stats
 * GET /api/admin/stats/offramp
 */
export async function GET() {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Get all off-ramp transactions
    const { data: allTransactions, error } = await supabaseAdmin
      .from("offramp_transactions")
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
    const currentCompleted = currentPeriod.filter((tx) => tx.status === "completed");
    const currentTotalNGNPaid = currentCompleted.reduce((sum, tx) => {
      return sum + parseFloat(String(tx.ngn_amount || "0"));
    }, 0);
    const currentTotalUSDC = currentCompleted.reduce((sum, tx) => {
      return sum + parseFloat(tx.usdc_amount || "0");
    }, 0);
    const currentTotalFees = currentCompleted.reduce((sum, tx) => {
      return sum + parseFloat(String(tx.fee_ngn || "0"));
    }, 0);

    const currentPending = currentPeriod.filter((tx) => 
      tx.status === "pending" || 
      tx.status === "token_received" || 
      tx.status === "swapping" || 
      tx.status === "usdc_received" || 
      tx.status === "paying"
    ).length;
    const currentSuccessful = currentCompleted.length;
    const currentFailed = currentPeriod.filter((tx) => tx.status === "failed").length;

    // Calculate previous period stats
    const previousCompleted = previousPeriod.filter((tx) => tx.status === "completed");
    const previousTotalNGNPaid = previousCompleted.reduce((sum, tx) => {
      return sum + parseFloat(String(tx.ngn_amount || "0"));
    }, 0);
    const previousTotalUSDC = previousCompleted.reduce((sum, tx) => {
      return sum + parseFloat(tx.usdc_amount || "0");
    }, 0);
    const previousTotalFees = previousCompleted.reduce((sum, tx) => {
      return sum + parseFloat(String(tx.fee_ngn || "0"));
    }, 0);

    const previousPending = previousPeriod.filter((tx) => 
      tx.status === "pending" || 
      tx.status === "token_received" || 
      tx.status === "swapping" || 
      tx.status === "usdc_received" || 
      tx.status === "paying"
    ).length;
    const previousSuccessful = previousCompleted.length;
    const previousFailed = previousPeriod.filter((tx) => tx.status === "failed").length;

    // Calculate average swap amount
    const averageSwapAmount = currentCompleted.length > 0
      ? currentTotalUSDC / currentCompleted.length
      : 0;

    // Calculate percentage changes
    const percentageChanges = {
      totalTransactions: calculatePercentageChange(transactions.length, previousPeriod.length),
      totalUSDC: calculatePercentageChange(currentTotalUSDC, previousTotalUSDC),
      totalNGNPaid: calculatePercentageChange(currentTotalNGNPaid, previousTotalNGNPaid),
      totalFees: calculatePercentageChange(currentTotalFees, previousTotalFees),
      pendingSwaps: calculatePercentageChange(currentPending, previousPending),
      completedSwaps: calculatePercentageChange(currentSuccessful, previousSuccessful),
      failedSwaps: calculatePercentageChange(currentFailed, previousFailed),
    };

    const stats = {
      totalTransactions: transactions.length,
      totalUSDC: currentTotalUSDC,
      totalNGNPaid: currentTotalNGNPaid,
      totalFees: currentTotalFees,
      pendingSwaps: currentPending,
      completedSwaps: currentSuccessful,
      failedSwaps: currentFailed,
      averageSwapAmount,
      percentageChanges,
    };

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error("Error fetching off-ramp stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch off-ramp stats", details: error.message },
      { status: 500 }
    );
  }
}

