import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Get combined stats for on-ramp and off-ramp
 * GET /api/admin/stats/combined
 */
export async function GET() {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Get on-ramp transactions
    const { data: onrampTransactions, error: onrampError } = await supabaseAdmin
      .from("transactions")
      .select("*");

    // Get off-ramp transactions
    const { data: offrampTransactions, error: offrampError } = await supabaseAdmin
      .from("offramp_transactions")
      .select("*");

    if (onrampError || offrampError) {
      console.error("Error fetching transactions:", { onrampError, offrampError });
      throw onrampError || offrampError;
    }

    const onramp = onrampTransactions || [];
    const offramp = offrampTransactions || [];

    // Helper function to calculate percentage change
    const calculatePercentageChange = (current: number, previous: number): string => {
      if (previous === 0) {
        return current > 0 ? "+100%" : "0%";
      }
      const change = ((current - previous) / previous) * 100;
      const sign = change >= 0 ? "+" : "";
      return `${sign}${change.toFixed(1)}%`;
    };

    // Filter by period
    const currentOnramp = onramp.filter((tx) => new Date(tx.created_at) >= sevenDaysAgo);
    const previousOnramp = onramp.filter((tx) => {
      const txDate = new Date(tx.created_at);
      return txDate >= fourteenDaysAgo && txDate < sevenDaysAgo;
    });

    const currentOfframp = offramp.filter((tx) => new Date(tx.created_at) >= sevenDaysAgo);
    const previousOfframp = offramp.filter((tx) => {
      const txDate = new Date(tx.created_at);
      return txDate >= fourteenDaysAgo && txDate < sevenDaysAgo;
    });

    // Calculate on-ramp stats
    const onrampCompleted = currentOnramp.filter((tx) => tx.status === "completed");
    const onrampTotalRevenue = onrampCompleted.reduce((sum, tx) => sum + parseFloat(tx.ngn_amount || "0"), 0);
    const onrampTotalTokens = onrampCompleted.reduce((sum, tx) => sum + parseFloat(tx.send_amount || "0"), 0);
    const onrampPending = currentOnramp.filter((tx) => tx.status === "pending").length;
    const onrampSuccessful = onrampCompleted.length;
    const onrampFailed = currentOnramp.filter((tx) => tx.status === "failed").length;

    const prevOnrampCompleted = previousOnramp.filter((tx) => tx.status === "completed");
    const prevOnrampRevenue = prevOnrampCompleted.reduce((sum, tx) => sum + parseFloat(tx.ngn_amount || "0"), 0);
    const prevOnrampTokens = prevOnrampCompleted.reduce((sum, tx) => sum + parseFloat(tx.send_amount || "0"), 0);
    const prevOnrampPending = previousOnramp.filter((tx) => tx.status === "pending").length;
    const prevOnrampSuccessful = prevOnrampCompleted.length;
    const prevOnrampFailed = previousOnramp.filter((tx) => tx.status === "failed").length;

    // Calculate off-ramp stats
    const offrampCompleted = currentOfframp.filter((tx) => tx.status === "completed");
    const offrampTotalNGNPaid = offrampCompleted.reduce((sum, tx) => sum + parseFloat(String(tx.ngn_amount || "0")), 0);
    const offrampTotalUSDC = offrampCompleted.reduce((sum, tx) => sum + parseFloat(tx.usdc_amount || "0"), 0);
    const offrampPending = currentOfframp.filter((tx) => tx.status === "pending" || tx.status === "token_received" || tx.status === "swapping" || tx.status === "usdc_received" || tx.status === "paying").length;
    const offrampSuccessful = offrampCompleted.length;
    const offrampFailed = currentOfframp.filter((tx) => tx.status === "failed").length;

    const prevOfframpCompleted = previousOfframp.filter((tx) => tx.status === "completed");
    const prevOfframpNGNPaid = prevOfframpCompleted.reduce((sum, tx) => sum + parseFloat(String(tx.ngn_amount || "0")), 0);
    const prevOfframpUSDC = prevOfframpCompleted.reduce((sum, tx) => sum + parseFloat(tx.usdc_amount || "0"), 0);
    const prevOfframpPending = previousOfframp.filter((tx) => tx.status === "pending" || tx.status === "token_received" || tx.status === "swapping" || tx.status === "usdc_received" || tx.status === "paying").length;
    const prevOfframpSuccessful = prevOfframpCompleted.length;
    const prevOfframpFailed = previousOfframp.filter((tx) => tx.status === "failed").length;

    // Combined totals
    const totalTransactions = onramp.length + offramp.length;
    const totalRevenue = onrampTotalRevenue; // On-ramp revenue (NGN received)
    const totalTokens = onrampTotalTokens + offrampTotalUSDC; // SEND distributed + USDC swapped
    const totalPending = onrampPending + offrampPending;
    const totalSuccessful = onrampSuccessful + offrampSuccessful;
    const totalFailed = onrampFailed + offrampFailed;

    // Previous period totals
    const prevTotalTransactions = previousOnramp.length + previousOfframp.length;
    const prevTotalRevenue = prevOnrampRevenue;
    const prevTotalTokens = prevOnrampTokens + prevOfframpUSDC;
    const prevTotalPending = prevOnrampPending + prevOfframpPending;
    const prevTotalSuccessful = prevOnrampSuccessful + prevOfframpSuccessful;
    const prevTotalFailed = prevOnrampFailed + prevOfframpFailed;

    // Calculate percentage changes
    const percentageChanges = {
      totalTransactions: calculatePercentageChange(totalTransactions, prevTotalTransactions),
      totalRevenue: calculatePercentageChange(totalRevenue, prevTotalRevenue),
      totalTokens: calculatePercentageChange(totalTokens, prevTotalTokens),
      totalPending: calculatePercentageChange(totalPending, prevTotalPending),
      totalSuccessful: calculatePercentageChange(totalSuccessful, prevTotalSuccessful),
      totalFailed: calculatePercentageChange(totalFailed, prevTotalFailed),
    };

    const stats = {
      totalTransactions,
      totalRevenue,
      totalTokens,
      totalPending,
      totalSuccessful,
      totalFailed,
      // Breakdown
      onramp: {
        totalTransactions: onramp.length,
        totalRevenue: onrampTotalRevenue,
        totalTokens: onrampTotalTokens,
        pending: onrampPending,
        successful: onrampSuccessful,
        failed: onrampFailed,
      },
      offramp: {
        totalTransactions: offramp.length,
        totalNGNPaid: offrampTotalNGNPaid,
        totalUSDC: offrampTotalUSDC,
        pending: offrampPending,
        successful: offrampSuccessful,
        failed: offrampFailed,
      },
      percentageChanges,
    };

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error("Error fetching combined stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch combined stats", details: error.message },
      { status: 500 }
    );
  }
}

