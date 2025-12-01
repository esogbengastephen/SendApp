import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    // Query all transactions from Supabase
    const { data: allTransactions, error } = await supabase
      .from("transactions")
      .select("*");

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    const transactions = allTransactions || [];

    // Calculate total SEND tokens distributed
    // Only count completed transactions with txHash (tokens actually sent to blockchain)
    const completedWithTokens = transactions.filter(
      (tx) => tx.status === "completed" && tx.tx_hash
    );
    
    const totalTokensDistributed = completedWithTokens.reduce((sum, tx) => {
      const sendAmount = parseFloat(tx.send_amount) || 0;
      return sum + sendAmount;
    }, 0);

    console.log(
      `[Stats] Total tokens distributed: ${completedWithTokens.length} transactions, ${totalTokensDistributed.toLocaleString()} SEND`
    );

    // Calculate total revenue from completed transactions
    const completedTransactions = transactions.filter(
      (tx) => tx.status === "completed"
    );
    
    const totalRevenue = completedTransactions.reduce((sum, tx) => {
      return sum + parseFloat(tx.ngn_amount);
    }, 0);

    // Calculate stats
    const stats = {
      totalTransactions: transactions.length,
      totalRevenue: totalRevenue,
      totalTokensDistributed: totalTokensDistributed,
      pendingPayments: transactions.filter((tx) => tx.status === "pending").length,
      successfulPayments: completedTransactions.length,
      failedPayments: transactions.filter((tx) => tx.status === "failed").length,
    };

    console.log("[Stats] Dashboard stats:", {
      total: stats.totalTransactions,
      completed: stats.successfulPayments,
      tokens: `${stats.totalTokensDistributed.toLocaleString()} SEND`,
      revenue: `₦${stats.totalRevenue.toLocaleString()}`,
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

