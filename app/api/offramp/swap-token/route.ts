import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { supabaseAdmin } from "@/lib/supabase";
import { generateOfframpWallet, getAdminWalletAddress } from "@/lib/offramp-wallet";
import { getSwapTransaction, USDC_BASE_ADDRESS } from "@/lib/1inch-swap";
import { BASE_RPC_URL } from "@/lib/constants";

/**
 * Swap token to USDC and send to admin wallet
 * POST /api/offramp/swap-token
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

    // Verify token is received
    if (transaction.status !== "token_received" || !transaction.token_address || !transaction.token_amount_raw) {
      return NextResponse.json(
        {
          success: false,
          message: "Token not received yet or already processed",
        },
        { status: 400 }
      );
    }

    // Check if already swapping or swapped
    if (transaction.status === "swapping" || transaction.status === "usdc_received") {
      return NextResponse.json({
        success: true,
        message: "Swap already in progress or completed",
        status: transaction.status,
        swapTxHash: transaction.swap_tx_hash,
      });
    }

    // Get the private key for this unique wallet
    const wallet = generateOfframpWallet(transactionId);
    const adminWallet = getAdminWalletAddress();

    // Update status to swapping
    await supabaseAdmin
      .from("offramp_transactions")
      .update({
        status: "swapping",
        updated_at: new Date().toISOString(),
      })
      .eq("transaction_id", transactionId);

    // Get swap transaction data from 1inch
    const fromTokenAddress = transaction.token_address; // null for ETH
    const amount = transaction.token_amount_raw;

    console.log(`[Swap Token] Getting swap transaction for ${transaction.token_symbol} → USDC`);
    console.log(`[Swap Token] Amount: ${amount}, From: ${wallet.address}, To: ${adminWallet}`);

    const swapResult = await getSwapTransaction(
      fromTokenAddress,
      USDC_BASE_ADDRESS,
      amount,
      adminWallet, // Send USDC directly to admin wallet
      1 // 1% slippage
    );

    if (!swapResult.success || !swapResult.tx) {
      console.error("[Swap Token] Failed to get swap transaction:", swapResult.error);
      
      // Update status back to token_received
      await supabaseAdmin
        .from("offramp_transactions")
        .update({
          status: "token_received",
          error_message: swapResult.error || "Failed to get swap transaction",
          updated_at: new Date().toISOString(),
        })
        .eq("transaction_id", transactionId);

      return NextResponse.json(
        {
          success: false,
          message: swapResult.error || "Failed to get swap transaction",
        },
        { status: 500 }
      );
    }

    // Create wallet client with the unique wallet's private key
    const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    const publicClient = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    // Execute the swap transaction
    console.log(`[Swap Token] Executing swap transaction...`);
    
    try {
      const txHash = await walletClient.sendTransaction({
        to: swapResult.tx.to as `0x${string}`,
        data: swapResult.tx.data as `0x${string}`,
        value: swapResult.tx.value ? BigInt(swapResult.tx.value) : 0n,
        gas: swapResult.tx.gas ? BigInt(swapResult.tx.gas) : undefined,
      });

      console.log(`[Swap Token] ✅ Swap transaction sent: ${txHash}`);

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      if (receipt.status === "success") {
        // Get USDC amount from the swap result
        const usdcAmount = swapResult.tx.dstAmount || "0";
        const usdcAmountFormatted = formatUnits(BigInt(usdcAmount), 6); // USDC has 6 decimals
        
        // Update transaction with swap info
        await supabaseAdmin
          .from("offramp_transactions")
          .update({
            swap_tx_hash: txHash,
            usdc_amount: usdcAmountFormatted,
            usdc_amount_raw: usdcAmount,
            swap_attempts: (transaction.swap_attempts || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("transaction_id", transactionId);

        // Record swap attempt
        await supabaseAdmin.from("offramp_swap_attempts").insert({
          transaction_id: transactionId,
          attempt_number: (transaction.swap_attempts || 0) + 1,
          swap_tx_hash: txHash,
          status: "success",
        });

        // Note: We'll verify USDC received in admin wallet in a separate step
        // For now, update status to usdc_received (we'll verify in process-payment)
        
        return NextResponse.json({
          success: true,
          swapTxHash: txHash,
          usdcAmount: usdcAmountFormatted,
          message: "Swap transaction successful",
        });
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error: any) {
      console.error("[Swap Token] Error executing swap:", error);
      
      // Update transaction with error
      await supabaseAdmin
        .from("offramp_transactions")
        .update({
          status: "token_received",
          error_message: error.message || "Swap transaction failed",
          swap_attempts: (transaction.swap_attempts || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("transaction_id", transactionId);

      // Record failed swap attempt
      await supabaseAdmin.from("offramp_swap_attempts").insert({
        transaction_id: transactionId,
        attempt_number: (transaction.swap_attempts || 0) + 1,
        status: "failed",
        error_message: error.message || "Swap transaction failed",
      });

      return NextResponse.json(
        {
          success: false,
          message: error.message || "Failed to execute swap transaction",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Swap Token] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "An error occurred",
      },
      { status: 500 }
    );
  }
}

