import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { scanWalletForAllTokens } from "@/lib/wallet-scanner";

/**
 * Check wallet for incoming tokens
 * POST /api/offramp/check-token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId } = body;

    if (!transactionId) {
      return NextResponse.json(
        {
          success: false,
          message: "Transaction ID is required",
        },
        { status: 400 }
      );
    }

    // Get transaction from database
    const { data: transaction, error: txError } = await supabaseAdmin
      .from("offramp_transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single();

    if (txError || !transaction) {
      return NextResponse.json(
        {
          success: false,
          message: "Transaction not found",
        },
        { status: 404 }
      );
    }

    // If token already detected, return existing info
    if (transaction.status !== "pending" && transaction.token_address) {
      return NextResponse.json({
        success: true,
        tokenDetected: true,
        tokenAddress: transaction.token_address,
        tokenSymbol: transaction.token_symbol,
        tokenAmount: transaction.token_amount,
        status: transaction.status,
      });
    }

    const walletAddress = transaction.unique_wallet_address;

    // Use wallet scanner to find ALL tokens
    console.log(`[Check Token] Scanning wallet ${walletAddress} for all tokens...`);
    const allTokens = await scanWalletForAllTokens(walletAddress);

    // If no tokens detected, return
    if (allTokens.length === 0) {
      return NextResponse.json({
        success: true,
        tokenDetected: false,
        tokens: [],
        message: "No tokens detected in wallet",
      });
    }

    console.log(`[Check Token] Found ${allTokens.length} token(s):`, allTokens.map(t => `${t.symbol} (${t.amount})`));

    // For backward compatibility, use the first token as the primary token
    // But also store all tokens in the response
    const primaryToken = allTokens[0];

    // Update transaction with primary token info (for backward compatibility)
    // Also store all tokens as JSON
    const { error: updateError } = await supabaseAdmin
      .from("offramp_transactions")
      .update({
        token_address: primaryToken.address,
        token_symbol: primaryToken.symbol,
        token_amount: primaryToken.amount,
        token_amount_raw: primaryToken.amountRaw,
        status: "token_received",
        token_received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Store all tokens as JSON for complete wallet emptying
        all_tokens_detected: JSON.stringify(allTokens),
      })
      .eq("transaction_id", transactionId);

    if (updateError) {
      console.error("[Check Token] Error updating transaction:", updateError);
      return NextResponse.json(
        {
          success: false,
          message: "Failed to update transaction",
        },
        { status: 500 }
      );
    }

    console.log(`[Check Token] ✅ ${allTokens.length} token(s) detected. Primary: ${primaryToken.symbol} - ${primaryToken.amount}`);

    return NextResponse.json({
      success: true,
      tokenDetected: true,
      // Backward compatibility fields
      tokenAddress: primaryToken.address,
      tokenSymbol: primaryToken.symbol,
      tokenAmount: primaryToken.amount,
      // New fields for all tokens
      tokens: allTokens.map(t => ({
        address: t.address,
        symbol: t.symbol,
        amount: t.amount,
        amountRaw: t.amountRaw,
        decimals: t.decimals,
      })),
      tokenCount: allTokens.length,
      status: "token_received",
    });
  } catch (error) {
    console.error("[Check Token] Error checking token:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "An error occurred",
      },
      { status: 500 }
    );
  }
}

