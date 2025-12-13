import { NextRequest, NextResponse } from "next/server";
import { isAdminWallet } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Find transaction by wallet address and trigger swap
 * POST /api/admin/offramp/find-and-swap
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminWallet, walletAddress } = body;

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

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: "Wallet address is required" },
        { status: 400 }
      );
    }

    // Find transaction by wallet address
    // Note: Multiple transactions can share the same wallet address
    // Get the most recent pending or token_received transaction, or most recent overall
    const { data: transactions, error } = await supabaseAdmin
      .from("offramp_transactions")
      .select("*")
      .eq("unique_wallet_address", walletAddress.toLowerCase())
      .order("created_at", { ascending: false });

    if (error || !transactions || transactions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Transaction not found for this wallet address",
          walletAddress: walletAddress.toLowerCase(),
        },
        { status: 404 }
      );
    }

    // Prefer pending or token_received transactions, otherwise use most recent
    const transaction = transactions.find(t => 
      t.status === "pending" || t.status === "token_received"
    ) || transactions[0];

    // Check if token is already detected
    if (!transaction.token_address || !transaction.token_amount_raw) {
      // First, check for tokens
      const checkResponse = await fetch(`${request.nextUrl.origin}/api/offramp/check-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: transaction.transaction_id }),
      });

      const checkData = await checkResponse.json();
      
      if (!checkData.success || !checkData.tokenDetected) {
        return NextResponse.json({
          success: false,
          error: "No tokens detected in wallet",
          transactionId: transaction.transaction_id,
          status: transaction.status,
        });
      }

      // Token was just detected, update transaction
      const updatedTransaction = {
        ...transaction,
        token_address: checkData.tokenAddress,
        token_symbol: checkData.tokenSymbol,
        token_amount: checkData.tokenAmount,
        status: "token_received",
      };

      // Now trigger swap
      const swapResponse = await fetch(`${request.nextUrl.origin}/api/offramp/swap-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: transaction.transaction_id }),
      });

      const swapData = await swapResponse.json();

      return NextResponse.json({
        success: swapData.success,
        message: swapData.success
          ? "Token detected and swap triggered successfully"
          : "Token detected but swap failed",
        transactionId: transaction.transaction_id,
        tokenInfo: {
          symbol: checkData.tokenSymbol,
          amount: checkData.tokenAmount,
        },
        swapResult: swapData,
      });
    }

    // Token already detected, trigger swap
    if (transaction.status === "token_received" || transaction.status === "pending") {
      const swapResponse = await fetch(`${request.nextUrl.origin}/api/offramp/swap-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: transaction.transaction_id }),
      });

      const swapData = await swapResponse.json();

      return NextResponse.json({
        success: swapData.success,
        message: swapData.success ? "Swap triggered successfully" : "Swap failed",
        transactionId: transaction.transaction_id,
        tokenInfo: {
          symbol: transaction.token_symbol,
          amount: transaction.token_amount,
        },
        swapResult: swapData,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Transaction found but already processed",
      transactionId: transaction.transaction_id,
      status: transaction.status,
      tokenInfo: {
        symbol: transaction.token_symbol,
        amount: transaction.token_amount,
      },
    });
  } catch (error: any) {
    console.error("[Find and Swap] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

