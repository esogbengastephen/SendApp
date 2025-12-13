import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminWallet } from "@/lib/supabase";

/**
 * Get combined transactions (on-ramp + off-ramp)
 * GET /api/admin/transactions/combined
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const adminWallet = searchParams.get("adminWallet");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "100");

    // Verify admin access
    if (!adminWallet) {
      return NextResponse.json(
        { success: false, error: "Admin wallet address required" },
        { status: 400 }
      );
    }

    const isAdmin = await isAdminWallet(adminWallet);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    // Get on-ramp transactions
    let onrampQuery = supabaseAdmin
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status && ["pending", "completed", "failed"].includes(status)) {
      onrampQuery = onrampQuery.eq("status", status);
    }

    const { data: onrampTransactions, error: onrampError } = await onrampQuery;

    // Get off-ramp transactions
    let offrampQuery = supabaseAdmin
      .from("offramp_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      if (status === "pending") {
        offrampQuery = offrampQuery.in("status", ["pending", "token_received"]);
      } else if (status === "completed") {
        offrampQuery = offrampQuery.eq("status", "completed");
      } else if (status === "failed") {
        offrampQuery = offrampQuery.eq("status", "failed");
      }
    }

    const { data: offrampTransactions, error: offrampError } = await offrampQuery;

    if (onrampError || offrampError) {
      console.error("Error fetching transactions:", { onrampError, offrampError });
      return NextResponse.json(
        { success: false, error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    // Get user emails for on-ramp transactions
    const userIds = [...new Set((onrampTransactions || []).filter(tx => tx.user_id).map(tx => tx.user_id))];
    const userEmailsMap = new Map<string, string>();
    
    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("id, email")
        .in("id", userIds);
      
      (users || []).forEach((user) => {
        userEmailsMap.set(user.id, user.email);
      });
    }

    // Format on-ramp transactions
    const formattedOnramp = (onrampTransactions || []).map((tx) => ({
      type: "on-ramp" as const,
      transactionId: tx.transaction_id,
      userEmail: tx.user_id ? (userEmailsMap.get(tx.user_id) || "User") : "Guest",
      amountNGN: parseFloat(tx.ngn_amount || "0"),
      tokenAmount: tx.send_amount || "0",
      tokenSymbol: "SEND",
      status: tx.status,
      date: tx.created_at,
      completedAt: tx.completed_at,
      txHash: tx.tx_hash,
      walletAddress: tx.wallet_address,
      paystackReference: tx.paystack_reference,
      errorMessage: tx.error_message,
    }));

    // Format off-ramp transactions
    const formattedOfframp = (offrampTransactions || []).map((tx) => ({
      type: "off-ramp" as const,
      transactionId: tx.transaction_id,
      userEmail: tx.user_email || "Guest",
      amountNGN: parseFloat(String(tx.ngn_amount || "0")),
      tokenAmount: tx.usdc_amount || tx.token_amount || "0",
      tokenSymbol: tx.token_symbol || "USDC",
      status: tx.status,
      date: tx.created_at,
      completedAt: tx.paid_at,
      txHash: tx.swap_tx_hash,
      walletAddress: tx.unique_wallet_address,
      paystackReference: tx.paystack_reference,
      errorMessage: tx.error_message,
    }));

    // Combine and sort by date (newest first)
    const combined = [...formattedOnramp, ...formattedOfframp].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return NextResponse.json({
      success: true,
      transactions: combined,
      total: combined.length,
      onrampCount: formattedOnramp.length,
      offrampCount: formattedOfframp.length,
    });
  } catch (error: any) {
    console.error("Error fetching combined transactions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch transactions", details: error.message },
      { status: 500 }
    );
  }
}

