import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Check if user has any completed payments for their virtual account
 * Used for polling payment status after user clicks "I have sent"
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const walletAddress = searchParams.get("walletAddress");
    const accountNumber = searchParams.get("accountNumber");

    if (!userId || !walletAddress || !accountNumber) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    console.log(`[Check Payment] Looking for payments: userId=${userId}, wallet=${walletAddress.slice(0, 10)}..., account=${accountNumber}`);

    // Check for completed transactions for this user in the last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("wallet_address", walletAddress.toLowerCase())
      .eq("status", "completed")
      .gte("created_at", thirtyMinutesAgo)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Check Payment] Database error:", error);
      return NextResponse.json(
        { success: false, error: "Database error" },
        { status: 500 }
      );
    }

    if (transactions && transactions.length > 0) {
      console.log(`[Check Payment] ✅ Found ${transactions.length} completed transaction(s)`);
      return NextResponse.json({
        success: true,
        transactions: transactions.map(tx => ({
          transactionId: tx.transaction_id,
          ngnAmount: tx.ngn_amount,
          sendAmount: tx.send_amount,
          txHash: tx.tx_hash,
          completedAt: tx.completed_at,
          paystackReference: tx.paystack_reference,
        })),
      });
    }

    console.log("[Check Payment] No completed transactions found yet (still checking...)");
    return NextResponse.json({
      success: true,
      transactions: [],
    });
  } catch (error: any) {
    console.error("[Check Payment] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
