import { NextRequest, NextResponse } from "next/server";
import { isAdminWallet } from "@/lib/supabase";
import { updateTransaction, getTransaction } from "@/lib/transactions";

/**
 * POST /api/admin/onramp/resolve
 * Mark a transaction as manually resolved (completed) when tokens were sent manually.
 * Requires admin auth. Only pending or failed transactions can be resolved.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const walletAddress = authHeader.replace("Bearer ", "").trim();
    const isAdmin = await isAdminWallet(walletAddress);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const transactionId = body?.transactionId ?? body?.transaction_id;
    if (!transactionId || typeof transactionId !== "string") {
      return NextResponse.json(
        { success: false, error: "transactionId is required" },
        { status: 400 }
      );
    }

    const existing = await getTransaction(transactionId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (existing.status === "completed") {
      return NextResponse.json(
        { success: true, message: "Already completed", transaction: existing },
        { status: 200 }
      );
    }

    const updated = await updateTransaction(transactionId, {
      status: "completed",
      errorMessage: undefined,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Failed to update transaction" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Transaction marked as manually resolved",
      transaction: updated,
    });
  } catch (error: unknown) {
    console.error("Error in POST /api/admin/onramp/resolve:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to resolve transaction",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
