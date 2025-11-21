import { NextResponse } from "next/server";
import { getAllTransactions } from "@/lib/transactions";

export async function GET() {
  try {
    const allTransactions = getAllTransactions();

    const stats = {
      totalTransactions: allTransactions.length,
      totalRevenue: allTransactions
        .filter((tx) => tx.status === "completed")
        .reduce((sum, tx) => sum + tx.ngnAmount, 0),
      totalTokensDistributed: allTransactions
        .filter((tx) => tx.status === "completed")
        .reduce((sum, tx) => sum + parseFloat(tx.sendAmount), 0),
      pendingPayments: allTransactions.filter((tx) => tx.status === "pending").length,
      successfulPayments: allTransactions.filter((tx) => tx.status === "completed").length,
      failedPayments: allTransactions.filter((tx) => tx.status === "failed").length,
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

