import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // Build query
    let query = supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false });

    // Filter by status if provided
    if (status && ["pending", "completed", "failed"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    console.log(`[Transactions API] Retrieved ${transactions?.length || 0} transactions${status ? ` (status: ${status})` : ""}`);

    return NextResponse.json({
      success: true,
      transactions: (transactions || []).map((tx) => ({
        transactionId: tx.transaction_id,
        paystackReference: tx.paystack_reference,
        ngnAmount: parseFloat(tx.ngn_amount),
        sendAmount: tx.send_amount,
        walletAddress: tx.wallet_address,
        userId: tx.user_id,
        status: tx.status,
        createdAt: tx.created_at,
        completedAt: tx.completed_at,
        txHash: tx.tx_hash,
        exchangeRate: tx.exchange_rate ? parseFloat(tx.exchange_rate) : undefined,
        sendtag: tx.sendtag,
        errorMessage: tx.error_message,
        verificationAttempts: tx.verification_attempts,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch transactions", details: error.message },
      { status: 500 }
    );
  }
}
