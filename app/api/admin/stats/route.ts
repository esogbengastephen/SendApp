import { NextResponse } from "next/server";
import { getAllTransactions } from "@/lib/transactions";
import axios from "axios";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API_BASE = "https://api.paystack.co";

export async function GET() {
  try {
    const allTransactions = getAllTransactions();
    
    // Also fetch from Paystack to get complete picture
    let paystackTransactions: any[] = [];
    if (PAYSTACK_SECRET_KEY) {
      try {
        const response = await axios.get(
          `${PAYSTACK_API_BASE}/transaction`,
          {
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            },
            params: {
              perPage: 100, // Get last 100 transactions
            },
          }
        );
        paystackTransactions = response.data.data || [];
      } catch (error) {
        console.error("Error fetching Paystack transactions for stats:", error);
        // Continue with just our transaction data
      }
    }

    // Calculate total SEND tokens distributed (only from transactions that actually sent tokens)
    // A transaction must have both status="completed" AND txHash to count (tokens were actually sent to blockchain)
    const completedWithTokens = allTransactions.filter((tx) => tx.status === "completed" && tx.txHash);
    const totalTokensDistributed = completedWithTokens.reduce((sum, tx) => {
      const sendAmount = parseFloat(tx.sendAmount) || 0;
      return sum + sendAmount;
    }, 0);
    
    console.log(`[Stats] Total tokens distributed calculation: ${completedWithTokens.length} transactions with tokens, total: ${totalTokensDistributed} SEND`);

    // Calculate total revenue from completed transactions
    const totalRevenue = allTransactions
      .filter((tx) => tx.status === "completed")
      .reduce((sum, tx) => sum + tx.ngnAmount, 0) || 
      paystackTransactions
        .filter((tx: any) => tx.status === "success")
        .reduce((sum: number, tx: any) => sum + (tx.amount / 100), 0);

    // Calculate stats
    const stats = {
      totalTransactions: allTransactions.length || paystackTransactions.length,
      totalRevenue: totalRevenue,
      totalTokensDistributed: totalTokensDistributed, // Only tokens that were actually sent (have txHash)
      pendingPayments: allTransactions.filter((tx) => tx.status === "pending").length,
      successfulPayments: allTransactions.filter((tx) => tx.status === "completed").length || 
        paystackTransactions.filter((tx: any) => tx.status === "success").length,
      failedPayments: allTransactions.filter((tx) => tx.status === "failed").length ||
        paystackTransactions.filter((tx: any) => tx.status === "failed").length,
    };

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}

