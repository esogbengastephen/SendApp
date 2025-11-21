import { NextResponse } from "next/server";
import { getAllTransactions, getTransactionsByStatus } from "@/lib/transactions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let transactions;
    if (status && ["pending", "completed", "failed"].includes(status)) {
      transactions = getTransactionsByStatus(status as "pending" | "completed" | "failed");
    } else {
      transactions = getAllTransactions();
    }

    // Sort by date (newest first)
    transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json({
      success: true,
      transactions: transactions.map((tx) => ({
        ...tx,
        createdAt: tx.createdAt.toISOString(),
        completedAt: tx.completedAt?.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

