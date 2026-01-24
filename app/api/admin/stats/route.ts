import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getTotalRevenueInSEND } from "@/lib/revenue";

export async function GET() {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Helper function to calculate percentage change
    const calculatePercentageChange = (current: number, previous: number): string => {
      if (previous === 0) {
        return current > 0 ? "+100%" : "0%";
      }
      const change = ((current - previous) / previous) * 100;
      const sign = change >= 0 ? "+" : "";
      return `${sign}${change.toFixed(1)}%`;
    };

    // Query all onramp transactions
    const { data: allTransactions, error: transactionsError } = await supabase
      .from("transactions")
      .select("*");

    if (transactionsError) {
      console.error("Supabase error (transactions):", transactionsError);
      throw transactionsError;
    }

    const transactions = allTransactions || [];

    // Query all offramp transactions
    const { data: allOfframpTransactions, error: offrampError } = await supabase
      .from("offramp_transactions")
      .select("*");

    if (offrampError) {
      console.error("Supabase error (offramp):", offrampError);
      // Don't throw, just log - offramp might not exist yet
    }

    const offrampTransactions = allOfframpTransactions || [];

    // Query all users for KYC and smart wallet stats - get count first for accurate total
    const { count: totalUsersCount, error: countError } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error("Supabase error (users count):", countError);
    }

    const { data: allUsers, error: usersError } = await supabase
      .from("users")
      .select("id, email, flutterwave_kyc_tier, flutterwave_nin, smart_wallet_address, solana_wallet_address");

    if (usersError) {
      console.error("Supabase error (users):", usersError);
      throw usersError;
    }

    const users = allUsers || [];
    const totalUsers = totalUsersCount || users.length;

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

    // Filter offramp transactions by period
    const currentOfframpPeriod = offrampTransactions.filter(
      (tx) => new Date(tx.created_at) >= sevenDaysAgo
    );
    const previousOfframpPeriod = offrampTransactions.filter(
      (tx) => {
        const txDate = new Date(tx.created_at);
        return txDate >= fourteenDaysAgo && txDate < sevenDaysAgo;
      }
    );

    // Calculate onramp stats
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
      const amount = typeof tx.ngn_amount === 'string' ? parseFloat(tx.ngn_amount) : (tx.ngn_amount || 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

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
      const amount = typeof tx.ngn_amount === 'string' ? parseFloat(tx.ngn_amount) : (tx.ngn_amount || 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    // Calculate all-time onramp totals
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
      const amount = typeof tx.ngn_amount === 'string' ? parseFloat(tx.ngn_amount) : (tx.ngn_amount || 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    // Calculate offramp stats
    const offrampByNetwork = {
      base: offrampTransactions.filter((tx) => tx.network === "base"),
      solana: offrampTransactions.filter((tx) => tx.network === "solana"),
    };

    const currentOfframpByNetwork = {
      base: currentOfframpPeriod.filter((tx) => tx.network === "base"),
      solana: currentOfframpPeriod.filter((tx) => tx.network === "solana"),
    };

    const previousOfframpByNetwork = {
      base: previousOfframpPeriod.filter((tx) => tx.network === "base"),
      solana: previousOfframpPeriod.filter((tx) => tx.network === "solana"),
    };

    // Offramp totals
    const offrampTotal = offrampTransactions.length;
    const offrampCompleted = offrampTransactions.filter((tx) => tx.status === "completed").length;
    const offrampPending = offrampTransactions.filter((tx) => 
      ["pending", "token_received", "swapping", "usdc_received", "paying"].includes(tx.status)
    ).length;
    const offrampFailed = offrampTransactions.filter((tx) => tx.status === "failed").length;

    const offrampTotalVolume = offrampTransactions
      .filter((tx) => tx.status === "completed" && tx.ngn_amount)
      .reduce((sum, tx) => sum + parseFloat(tx.ngn_amount?.toString() || "0"), 0);

    const currentOfframpVolume = currentOfframpPeriod
      .filter((tx) => tx.status === "completed" && tx.ngn_amount)
      .reduce((sum, tx) => sum + parseFloat(tx.ngn_amount?.toString() || "0"), 0);

    const previousOfframpVolume = previousOfframpPeriod
      .filter((tx) => tx.status === "completed" && tx.ngn_amount)
      .reduce((sum, tx) => sum + parseFloat(tx.ngn_amount?.toString() || "0"), 0);

    // Network-specific offramp stats
    const offrampStats = {
      total: {
        transactions: offrampTotal,
        completed: offrampCompleted,
        pending: offrampPending,
        failed: offrampFailed,
        volume: offrampTotalVolume,
        successRate: offrampTotal > 0 ? ((offrampCompleted / offrampTotal) * 100).toFixed(1) : "0",
      },
      base: {
        transactions: offrampByNetwork.base.length,
        completed: offrampByNetwork.base.filter((tx) => tx.status === "completed").length,
        pending: offrampByNetwork.base.filter((tx) => 
          ["pending", "token_received", "swapping", "usdc_received", "paying"].includes(tx.status)
        ).length,
        failed: offrampByNetwork.base.filter((tx) => tx.status === "failed").length,
        volume: offrampByNetwork.base
          .filter((tx) => tx.status === "completed" && tx.ngn_amount)
          .reduce((sum, tx) => sum + parseFloat(tx.ngn_amount?.toString() || "0"), 0),
      },
      solana: {
        transactions: offrampByNetwork.solana.length,
        completed: offrampByNetwork.solana.filter((tx) => tx.status === "completed").length,
        pending: offrampByNetwork.solana.filter((tx) => 
          ["pending", "token_received", "swapping", "usdc_received", "paying"].includes(tx.status)
        ).length,
        failed: offrampByNetwork.solana.filter((tx) => tx.status === "failed").length,
        volume: offrampByNetwork.solana
          .filter((tx) => tx.status === "completed" && tx.ngn_amount)
          .reduce((sum, tx) => sum + parseFloat(tx.ngn_amount?.toString() || "0"), 0),
      },
    };

    // Smart wallet stats
    const usersWithSmartWallets = users.filter((u) => u.smart_wallet_address).length;
    const usersWithSolanaWallets = users.filter((u) => u.solana_wallet_address).length;
    const usersWithBothWallets = users.filter(
      (u) => u.smart_wallet_address && u.solana_wallet_address
    ).length;

    // KYC tier distribution
    const kycDistribution = {
      tier1: users.filter((u) => u.flutterwave_kyc_tier === 1 || !u.flutterwave_kyc_tier).length,
      tier2: users.filter((u) => u.flutterwave_kyc_tier === 2).length,
      tier3: users.filter((u) => u.flutterwave_kyc_tier === 3).length,
      total: totalUsers,
    };

    // Calculate percentage changes
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
      offrampTransactions: calculatePercentageChange(
        currentOfframpPeriod.length,
        previousOfframpPeriod.length
      ),
      offrampVolume: calculatePercentageChange(
        currentOfframpVolume,
        previousOfframpVolume
      ),
    };

    // Calculate total revenue in $SEND from revenue table
    const totalRevenueInSEND = await getTotalRevenueInSEND();

    // Revenue breakdown by service type
    const revenueBreakdown = {
      onramp: allTimeTotalRevenue || 0,
      offramp: offrampTotalVolume || 0,
      total: (allTimeTotalRevenue || 0) + (offrampTotalVolume || 0),
    };

    // Network breakdown (onramp is Base, offramp has both)
    const networkBreakdown = {
      base: {
        onramp: allTimeTotalRevenue || 0, // All onramp is Base
        offramp: offrampStats.base.volume || 0,
        total: (allTimeTotalRevenue || 0) + (offrampStats.base.volume || 0),
      },
      solana: {
        onramp: 0, // No onramp on Solana yet
        offramp: offrampStats.solana.volume || 0,
        total: offrampStats.solana.volume || 0,
      },
    };

    // Calculate stats (all-time totals)
    const stats = {
      // User stats
      totalUsers: totalUsers || 0,
      
      // Onramp stats
      totalTransactions: transactions.length || 0,
      totalRevenue: allTimeTotalRevenue || 0,
      totalTokensDistributed: allTimeTotalTokensDistributed || 0,
      totalRevenueInSEND: totalRevenueInSEND || 0,
      pendingPayments: transactions.filter((tx) => tx.status === "pending").length || 0,
      successfulPayments: allTimeCompletedTransactions.length || 0,
      failedPayments: transactions.filter((tx) => tx.status === "failed").length || 0,
      
      // Offramp stats
      offramp: offrampStats,
      
      // Multi-chain stats
      networkBreakdown,
      
      // Smart wallet stats
      smartWallets: {
        totalUsers,
        usersWithSmartWallets,
        usersWithSolanaWallets,
        usersWithBothWallets,
        smartWalletAdoptionRate: totalUsers > 0 
          ? ((usersWithSmartWallets / totalUsers) * 100).toFixed(1) 
          : "0",
        solanaWalletAdoptionRate: totalUsers > 0 
          ? ((usersWithSolanaWallets / totalUsers) * 100).toFixed(1) 
          : "0",
      },
      
      // KYC stats
      kyc: kycDistribution,
      
      // Revenue breakdown
      revenueBreakdown: {
        onramp: revenueBreakdown.onramp || 0,
        offramp: revenueBreakdown.offramp || 0,
        total: (revenueBreakdown.onramp || 0) + (revenueBreakdown.offramp || 0),
      },
      
      // Percentage changes
      percentageChanges,
    };

    console.log("[Stats] Enhanced dashboard stats:", {
      users: {
        total: stats.totalUsers,
        withSmartWallets: stats.smartWallets.usersWithSmartWallets,
        withSolanaWallets: stats.smartWallets.usersWithSolanaWallets,
      },
      onramp: {
        total: stats.totalTransactions,
        completed: stats.successfulPayments,
        pending: stats.pendingPayments,
        failed: stats.failedPayments,
        revenue: `₦${stats.totalRevenue.toLocaleString()}`,
        tokensDistributed: `${stats.totalTokensDistributed.toLocaleString()} $SEND`,
      },
      offramp: {
        total: stats.offramp.total.transactions,
        completed: stats.offramp.total.completed,
        pending: stats.offramp.total.pending,
        failed: stats.offramp.total.failed,
        volume: `₦${stats.offramp.total.volume.toLocaleString()}`,
        base: stats.offramp.base.transactions,
        solana: stats.offramp.solana.transactions,
      },
      smartWallets: {
        total: stats.smartWallets.usersWithSmartWallets,
        adoption: `${stats.smartWallets.smartWalletAdoptionRate}%`,
      },
      kyc: stats.kyc,
      revenueBreakdown: {
        onramp: `₦${stats.revenueBreakdown.onramp.toLocaleString()}`,
        offramp: `₦${stats.revenueBreakdown.offramp.toLocaleString()}`,
        total: `₦${stats.revenueBreakdown.total.toLocaleString()}`,
      },
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
