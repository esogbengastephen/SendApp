import { NextRequest, NextResponse } from "next/server";
import { getAllTransactions, getTransaction } from "@/lib/transactions";

/**
 * Debug endpoint to check transaction storage
 * This helps verify if transactions are being stored correctly
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const transactionId = searchParams.get("id");

    if (transactionId) {
      // Get specific transaction
      const transaction = getTransaction(transactionId);
      return NextResponse.json({
        success: true,
        transaction: transaction ? {
          transactionId: transaction.transactionId,
          paystackReference: transaction.paystackReference,
          ngnAmount: transaction.ngnAmount,
          sendAmount: transaction.sendAmount,
          walletAddress: transaction.walletAddress,
          status: transaction.status,
          createdAt: transaction.createdAt.toISOString(),
          completedAt: transaction.completedAt?.toISOString(),
          txHash: transaction.txHash,
        } : null,
      });
    }

    // Get all transactions
    const allTransactions = getAllTransactions();
    
    return NextResponse.json({
      success: true,
      total: allTransactions.length,
      transactions: allTransactions.map((t) => ({
        transactionId: t.transactionId,
        paystackReference: t.paystackReference,
        ngnAmount: t.ngnAmount,
        sendAmount: t.sendAmount,
        walletAddress: t.walletAddress,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        completedAt: t.completedAt?.toISOString(),
        txHash: t.txHash,
      })),
      summary: {
        pending: allTransactions.filter((t) => t.status === "pending").length,
        completed: allTransactions.filter((t) => t.status === "completed").length,
        failed: allTransactions.filter((t) => t.status === "failed").length,
      },
    });
  } catch (error: any) {
    console.error("Debug transactions error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

