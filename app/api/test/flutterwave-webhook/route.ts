import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTransaction, updateTransaction } from "@/lib/transactions";
import { distributeTokens } from "@/lib/token-distribution";
import { getExchangeRate } from "@/lib/settings";
import { calculateTransactionFee, calculateFinalTokens, calculateFeeInTokens } from "@/lib/fee-calculation";
import { recordRevenue } from "@/lib/revenue";
import { sendTokenDistributionEmail } from "@/lib/transaction-emails";
import { updateReferralCountOnTransaction } from "@/lib/supabase";

/**
 * Test endpoint to manually trigger webhook processing for a transaction
 * This bypasses signature verification and allows testing webhook logic
 * 
 * Usage:
 * POST /api/test/flutterwave-webhook
 * Body: { txRef: "FLW-xxx" } or { transactionId: "xxx" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { txRef, transactionId } = body;

    if (!txRef && !transactionId) {
      return NextResponse.json(
        { success: false, error: "Either txRef or transactionId is required" },
        { status: 400 }
      );
    }

    console.log(`[Test Webhook] Starting manual webhook processing...`);
    console.log(`[Test Webhook] txRef: ${txRef || "N/A"}, transactionId: ${transactionId || "N/A"}`);

    // Find transaction
    let transaction = null;
    let foundBy = "";

    if (transactionId) {
      transaction = await getTransaction(transactionId);
      if (transaction) {
        foundBy = "transactionId";
      }
    }

    // If not found by transactionId, try by txRef
    if (!transaction && txRef) {
      // Strategy 1: Search by payment_reference
      const { data: txByPaymentRef } = await supabaseAdmin
        .from("transactions")
        .select("transaction_id, wallet_address, user_id, status, ngn_amount, send_amount, metadata, payment_reference")
        .eq("payment_reference", txRef)
        .eq("status", "pending")
        .maybeSingle();

      if (txByPaymentRef) {
        transaction = await getTransaction(txByPaymentRef.transaction_id);
        foundBy = "payment_reference";
      } else {
        // Strategy 2: Search by metadata->>flutterwave_tx_ref
        const { data: txByMetadata } = await supabaseAdmin
          .from("transactions")
          .select("transaction_id, wallet_address, user_id, status, ngn_amount, send_amount, metadata, payment_reference")
          .eq("metadata->>flutterwave_tx_ref", txRef)
          .eq("status", "pending")
          .maybeSingle();

        if (txByMetadata) {
          transaction = await getTransaction(txByMetadata.transaction_id);
          foundBy = "metadata->>flutterwave_tx_ref";
        }
      }
    }

    if (!transaction) {
      return NextResponse.json(
        {
          success: false,
          error: "Transaction not found",
          searchedBy: { txRef, transactionId },
          suggestion: "Check if transaction exists and is in 'pending' status",
        },
        { status: 404 }
      );
    }

    console.log(`[Test Webhook] ✅ Transaction found: ${transaction.transactionId} (found by: ${foundBy})`);
    console.log(`[Test Webhook] Status: ${transaction.status}, Wallet: ${transaction.walletAddress}`);

    if (transaction.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: `Transaction is not pending. Current status: ${transaction.status}`,
          transactionId: transaction.transactionId,
          status: transaction.status,
        },
        { status: 400 }
      );
    }

    if (!transaction.walletAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "Wallet address is missing from transaction",
          transactionId: transaction.transactionId,
        },
        { status: 400 }
      );
    }

    // Get exchange rate
    const exchangeRate = await getExchangeRate();
    if (!exchangeRate) {
      return NextResponse.json(
        { success: false, error: "Failed to get exchange rate" },
        { status: 500 }
      );
    }

    // Calculate fees and final token amount
    const feeNGN = await calculateTransactionFee(transaction.ngnAmount);
    const feeInSEND = calculateFeeInTokens(feeNGN, exchangeRate);
    const finalSendAmount = calculateFinalTokens(transaction.ngnAmount, feeNGN, exchangeRate);

    console.log(`[Test Webhook] Exchange rate: ${exchangeRate}`);
    console.log(`[Test Webhook] Fee (NGN): ${feeNGN}, Fee (SEND): ${feeInSEND}`);
    console.log(`[Test Webhook] Final SEND amount: ${finalSendAmount}`);

    // Record revenue
    const revenueResult = await recordRevenue(transaction.transactionId, feeNGN, feeInSEND);
    if (!revenueResult.success) {
      console.error(`[Test Webhook] ⚠️ Failed to record revenue: ${revenueResult.error}`);
    }

    // Get user email for notifications
    let userEmail: string | null = null;
    if (transaction.userId) {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("email")
        .eq("id", transaction.userId)
        .single();
      userEmail = user?.email || null;
    }

    // Distribute tokens
    console.log(`[Test Webhook] Starting token distribution...`);
    console.log(`[Test Webhook] Transaction ID: ${transaction.transactionId}`);
    console.log(`[Test Webhook] Wallet Address: ${transaction.walletAddress}`);
    console.log(`[Test Webhook] Amount: ${finalSendAmount} SEND`);

    const distributionResult = await distributeTokens(
      transaction.transactionId,
      transaction.walletAddress,
      finalSendAmount
    );

    if (!distributionResult.success) {
      console.error(`[Test Webhook] ❌ Token distribution failed: ${distributionResult.error}`);
      
      // Update transaction with error
      await updateTransaction(transaction.transactionId, {
        status: "failed",
        errorMessage: distributionResult.error || "Token distribution failed",
      });

      return NextResponse.json(
        {
          success: false,
          error: "Token distribution failed",
          details: distributionResult.error,
          transactionId: transaction.transactionId,
        },
        { status: 500 }
      );
    }

    console.log(`[Test Webhook] 🎉 Tokens distributed successfully! TX Hash: ${distributionResult.txHash}`);

    // Update transaction to completed
    await updateTransaction(transaction.transactionId, {
      status: "completed",
      txHash: distributionResult.txHash || "",
      completedAt: new Date(),
    });

    // Send token distribution email
    if (userEmail) {
      try {
        await sendTokenDistributionEmail(
          userEmail,
          transaction.ngnAmount,
          finalSendAmount.toString(),
          transaction.walletAddress,
          distributionResult.txHash || ""
        );
        console.log(`[Test Webhook] ✅ Token distribution email sent`);
      } catch (emailError) {
        console.error(`[Test Webhook] ⚠️ Failed to send email:`, emailError);
      }
    }

    // Update referral count
    if (transaction.userId) {
      try {
        const referralResult = await updateReferralCountOnTransaction(transaction.userId);
        if (referralResult.success) {
          console.log(`[Test Webhook] ✅ Referral count updated`);
        }
      } catch (error) {
        console.error(`[Test Webhook] ⚠️ Exception updating referral count:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Webhook processing completed successfully",
      transactionId: transaction.transactionId,
      txHash: distributionResult.txHash,
      sendAmount: finalSendAmount,
      feeNGN,
      feeInTokens: feeInSEND,
      foundBy,
    });
  } catch (error: any) {
    console.error("[Test Webhook] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - Show usage instructions
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: "Flutterwave Webhook Test Endpoint",
    usage: {
      method: "POST",
      endpoint: "/api/test/flutterwave-webhook",
      body: {
        txRef: "FLW-xxx-xxx-xxx (Flutterwave transaction reference)",
        transactionId: "xxx (Internal transaction ID)",
      },
      note: "Either txRef or transactionId is required",
    },
    description: "Manually triggers webhook processing for a pending transaction. Bypasses signature verification for testing purposes.",
  });
}
