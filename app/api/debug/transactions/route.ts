import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Debug endpoint to check transaction storage
 * This helps verify if transactions are being stored correctly in Supabase
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const transactionId = searchParams.get("id");

    if (transactionId) {
      // Get specific transaction
      const { data: transaction, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("transaction_id", transactionId)
        .maybeSingle();

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      return NextResponse.json({
        success: true,
        transaction: transaction ? {
          transactionId: transaction.transaction_id,
          paystackReference: transaction.paystack_reference,
          ngnAmount: parseFloat(transaction.ngn_amount),
          sendAmount: transaction.send_amount,
          walletAddress: transaction.wallet_address,
          userId: transaction.user_id,
          status: transaction.status,
          createdAt: transaction.created_at,
          completedAt: transaction.completed_at,
          txHash: transaction.tx_hash,
          errorMessage: transaction.error_message,
        } : null,
      });
    }

    // Get all transactions
    const { data: allTransactions, error } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    const transactions = allTransactions || [];
    
    return NextResponse.json({
      success: true,
      total: transactions.length,
      transactions: transactions.map((t) => ({
        transactionId: t.transaction_id,
        paystackReference: t.paystack_reference,
        ngnAmount: parseFloat(t.ngn_amount),
        sendAmount: t.send_amount,
        walletAddress: t.wallet_address,
        status: t.status,
        createdAt: t.created_at,
        completedAt: t.completed_at,
        txHash: t.tx_hash,
      })),
      summary: {
        pending: transactions.filter((t) => t.status === "pending").length,
        completed: transactions.filter((t) => t.status === "completed").length,
        failed: transactions.filter((t) => t.status === "failed").length,
      },
    });
  } catch (error: any) {
    console.error("Debug transactions error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
