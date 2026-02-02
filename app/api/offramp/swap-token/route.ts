/**
 * Off-Ramp Swap Token API
 * Swaps tokens to USDC and transfers to admin wallet
 * Supports both Base (with paymaster) and Solana (with gas sponsorship)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { swapAndTransferToAdmin as baseSwap } from "@/lib/base-offramp-swap";
import { swapAndTransferToAdmin as solanaSwap } from "@/lib/solana-offramp-swap";
import { getSolanaWalletFromEncrypted } from "@/lib/solana-wallet";
import { decryptWalletPrivateKey } from "@/lib/coinbase-smart-wallet";
import { getOfframpTransactionsEnabled } from "@/lib/settings";
import { Keypair } from "@solana/web3.js";

export async function POST(request: NextRequest) {
  try {
    const offrampEnabled = await getOfframpTransactionsEnabled();
    if (!offrampEnabled) {
      return NextResponse.json(
        { success: false, error: "Sell (offramp) transactions are currently disabled. Please check back later." },
        { status: 403 }
      );
    }

    const { transactionId } = await request.json();

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    // Get transaction from database
    const { data: transaction, error: txError } = await supabaseAdmin
      .from("offramp_transactions")
      .select(`
        *,
        users:user_id (
          id,
          smart_wallet_owner_encrypted,
          solana_wallet_private_key_encrypted
        )
      `)
      .eq("transaction_id", transactionId)
      .single();

    if (txError || !transaction) {
      console.error("[Off-ramp Swap] Transaction not found:", txError);
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Check if already swapped
    if (transaction.status === "swapped" || transaction.status === "payment_sent") {
      return NextResponse.json({
        success: true,
        message: "Token already swapped",
        swapTxHash: transaction.swap_tx_hash,
        usdcAmount: transaction.usdc_amount,
      });
    }

    // Validate required fields
    if (!transaction.token_contract_address || !transaction.token_amount) {
      return NextResponse.json(
        { success: false, error: "Token information missing in transaction" },
        { status: 400 }
      );
    }

    const user = transaction.users as any;
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    let swapResult;

    if (transaction.network === "base") {
      // Base network swap
      if (!user.smart_wallet_owner_encrypted || !transaction.smart_wallet_address) {
        return NextResponse.json(
          { success: false, error: "Smart wallet not found for user" },
          { status: 400 }
        );
      }

      // Decrypt private key
      const ownerPrivateKey = await decryptWalletPrivateKey(
        user.smart_wallet_owner_encrypted,
        user.id
      );

      // Get admin wallet from environment
      const adminWallet = process.env.ADMIN_WALLET_ADDRESS;
      if (!adminWallet) {
        return NextResponse.json(
          { success: false, error: "Admin wallet not configured" },
          { status: 500 }
        );
      }

      // Get token decimals from verified_tokens table if not in transaction
      let tokenDecimals = 18; // default
      if (!transaction.token_decimals) {
        const { data: tokenInfo } = await supabaseAdmin
          .from("verified_tokens")
          .select("token_decimals")
          .eq("network", "base")
          .eq("token_address", transaction.token_contract_address.toLowerCase())
          .single();
        
        if (tokenInfo?.token_decimals) {
          tokenDecimals = tokenInfo.token_decimals;
        }
      } else {
        tokenDecimals = transaction.token_decimals;
      }

      // Execute swap
      swapResult = await baseSwap(
        transaction.smart_wallet_address,
        ownerPrivateKey,
        transaction.token_contract_address,
        transaction.token_amount,
        tokenDecimals,
        adminWallet
      );
    } else if (transaction.network === "solana") {
      // Solana network swap
      if (!user.solana_wallet_private_key_encrypted || !transaction.solana_wallet_address) {
        return NextResponse.json(
          { success: false, error: "Solana wallet not found for user" },
          { status: 400 }
        );
      }

      // Get Solana wallet
      const solanaWallet = await getSolanaWalletFromEncrypted(
        user.solana_wallet_private_key_encrypted,
        user.id
      );

      // Create keypair from private key
      const userKeypair = Keypair.fromSecretKey(
        Buffer.from(solanaWallet.privateKey, "hex")
      );

      // Get admin wallet from environment
      const adminWallet = process.env.SOLANA_ADMIN_WALLET_ADDRESS;
      const adminPrivateKey = process.env.SOLANA_ADMIN_WALLET_PRIVATE_KEY;
      
      if (!adminWallet || !adminPrivateKey) {
        return NextResponse.json(
          { success: false, error: "Solana admin wallet not configured" },
          { status: 500 }
        );
      }

      // Get token decimals from verified_tokens table if not in transaction
      let tokenDecimals = 9; // default for Solana tokens
      if (!transaction.token_decimals) {
        const { data: tokenInfo } = await supabaseAdmin
          .from("verified_tokens")
          .select("token_decimals")
          .eq("network", "solana")
          .eq("token_address", transaction.token_contract_address)
          .single();
        
        if (tokenInfo?.token_decimals) {
          tokenDecimals = tokenInfo.token_decimals;
        }
      } else {
        tokenDecimals = transaction.token_decimals;
      }

      // Convert token amount (token_amount is in token units, need to convert to raw amount for Jupiter)
      // Jupiter expects amount in smallest unit (lamports for native SOL, token decimals for tokens)
      const tokenAmountRaw = parseFloat(transaction.token_amount) * Math.pow(10, tokenDecimals);

      // Execute swap
      swapResult = await solanaSwap(
        userKeypair,
        transaction.token_contract_address,
        tokenAmountRaw, // Pass raw amount to Jupiter
        adminWallet,
        adminPrivateKey,
        process.env.SOLANA_RPC_URL
      );
    } else {
      return NextResponse.json(
        { success: false, error: `Unsupported network: ${transaction.network}` },
        { status: 400 }
      );
    }

    if (!swapResult.success) {
      // Update transaction with error
      await supabaseAdmin
        .from("offramp_transactions")
        .update({
          status: "failed",
          error_message: swapResult.error,
          updated_at: new Date().toISOString(),
        })
        .eq("transaction_id", transactionId);

      return NextResponse.json(
        { success: false, error: swapResult.error || "Swap failed" },
        { status: 500 }
      );
    }

    // Update transaction with swap results
    const { error: updateError } = await supabaseAdmin
      .from("offramp_transactions")
      .update({
        status: "swapped",
        swap_tx_hash: swapResult.swapTxHash,
        usdc_amount: swapResult.usdcAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("transaction_id", transactionId);

    if (updateError) {
      console.error("[Off-ramp Swap] Failed to update transaction:", updateError);
    }

    return NextResponse.json({
      success: true,
      swapTxHash: swapResult.swapTxHash,
      transferTxHash: swapResult.transferTxHash,
      usdcAmount: swapResult.usdcAmount,
      message: "Token swapped to USDC and transferred to admin wallet",
    });
  } catch (error: any) {
    console.error("[Off-ramp Swap] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
