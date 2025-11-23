import { NextResponse } from "next/server";
import { getAllTransactions } from "@/lib/transactions";
import { formatDistanceToNow } from "date-fns";

export async function GET() {
  try {
    const allTransactions = getAllTransactions();
    
    // Sort by date (newest first) and take last 10
    const recentTransactions = allTransactions
      .sort((a, b) => {
        const dateA = a.completedAt || a.createdAt;
        const dateB = b.completedAt || b.createdAt;
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 10)
      .map((tx) => ({
        id: tx.transactionId,
        type: tx.status === "completed" ? "completed" : tx.status === "failed" ? "failed" : "pending",
        message: tx.status === "completed" 
          ? `Transaction ${tx.transactionId.slice(0, 8)}... completed`
          : tx.status === "failed"
          ? `Transaction ${tx.transactionId.slice(0, 8)}... failed`
          : `Transaction ${tx.transactionId.slice(0, 8)}... pending`,
        time: formatDistanceToNow(tx.completedAt || tx.createdAt, { addSuffix: true }),
        amount: tx.ngnAmount,
        wallet: tx.walletAddress.slice(0, 6) + "..." + tx.walletAddress.slice(-4),
        txHash: tx.txHash,
      }));
    
    return NextResponse.json({
      success: true,
      activities: recentTransactions,
    });
  } catch (error: any) {
    console.error("Error fetching recent activity:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch recent activity" },
      { status: 500 }
    );
  }
}

