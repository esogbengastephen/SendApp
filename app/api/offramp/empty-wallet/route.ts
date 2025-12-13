import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateUserOfframpWallet } from "@/lib/offramp-wallet";
import { emptyWallet } from "@/lib/wallet-emptier";

/**
 * Empty wallet completely: swap all tokens to USDC, transfer to master wallet, recover ETH
 * POST /api/offramp/empty-wallet
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

    // Get the wallet for this transaction
    const userIdentifier = transaction.user_id || transaction.user_email || `guest_${transaction.user_account_number}`;
    const wallet = generateUserOfframpWallet(userIdentifier);

    // Verify wallet address matches
    if (wallet.address.toLowerCase() !== transaction.unique_wallet_address.toLowerCase()) {
      console.warn(`[Empty Wallet] Wallet address mismatch. Using generated wallet: ${wallet.address}`);
    }

    console.log(`[Empty Wallet] Starting wallet emptying for transaction ${transactionId}`);
    console.log(`[Empty Wallet] Wallet address: ${wallet.address}`);

    // Empty the wallet
    const result = await emptyWallet(wallet.address, wallet.privateKey);

    // Update transaction with results
    if (result.success) {
      // Calculate total USDC amount (sum of all swapped tokens)
      const totalUSDC = parseFloat(result.totalUSDCReceived);

      // Update transaction status
      await supabaseAdmin
        .from("offramp_transactions")
        .update({
          status: "usdc_received",
          usdc_amount: result.totalUSDCReceived,
          usdc_amount_raw: (BigInt(Math.floor(totalUSDC * 1000000))).toString(), // USDC has 6 decimals
          usdc_received_at: new Date().toISOString(),
          wallet_emptied: true,
          updated_at: new Date().toISOString(),
          // Store all tokens found
          all_tokens_detected: JSON.stringify(result.tokensFound),
          // Store swap transaction hashes
          swap_tx_hash: result.swapTxHashes.length > 0 ? result.swapTxHashes[0] : null,
          error_message: result.errors.length > 0 ? result.errors.join("; ") : null,
        })
        .eq("transaction_id", transactionId);

      console.log(`[Empty Wallet] ✅ Wallet emptied successfully. USDC: ${result.totalUSDCReceived}, ETH recovered: ${result.ethRecovered}`);

      return NextResponse.json({
        success: true,
        message: "Wallet emptied successfully",
        tokensFound: result.tokensFound.length,
        tokensSwapped: result.tokensSwapped,
        totalUSDCReceived: result.totalUSDCReceived,
        ethRecovered: result.ethRecovered,
        walletEmpty: result.walletEmpty,
        swapTxHashes: result.swapTxHashes,
        errors: result.errors,
      });
    } else {
      // Update transaction with error
      await supabaseAdmin
        .from("offramp_transactions")
        .update({
          status: "failed",
          error_message: result.errors.join("; "),
          wallet_emptied: false,
          updated_at: new Date().toISOString(),
        })
        .eq("transaction_id", transactionId);

      console.error(`[Empty Wallet] ❌ Failed to empty wallet. Errors:`, result.errors);

      return NextResponse.json(
        {
          success: false,
          message: "Failed to empty wallet",
          tokensFound: result.tokensFound.length,
          tokensSwapped: result.tokensSwapped,
          totalUSDCReceived: result.totalUSDCReceived,
          ethRecovered: result.ethRecovered,
          walletEmpty: result.walletEmpty,
          errors: result.errors,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Empty Wallet] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "An error occurred",
      },
      { status: 500 }
    );
  }
}
