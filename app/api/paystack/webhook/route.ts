import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import {
  getTransactionByReference,
  updateTransaction,
  isTransactionProcessed,
} from "@/lib/transactions";
import { distributeTokens } from "@/lib/token-distribution";

export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get("x-paystack-signature");

    if (!signature) {
      return NextResponse.json(
        { success: false, error: "Missing signature" },
        { status: 401 }
      );
    }

    // Verify webhook signature
    const isValid = verifyWebhookSignature(body, signature);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return NextResponse.json(
        { success: false, error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse the webhook payload
    const event = JSON.parse(body);

    // Handle different event types
    if (event.event === "charge.success") {
      const transactionData = event.data;
      const reference = transactionData.reference;

      // Check if transaction has already been processed
      if (isTransactionProcessed(reference)) {
        console.log(`Transaction ${reference} already processed`);
        return NextResponse.json({ success: true, message: "Already processed" });
      }

      // Get our transaction record
      const transaction = getTransactionByReference(reference);
      if (!transaction) {
        console.error(`Transaction not found for reference: ${reference}`);
        return NextResponse.json(
          { success: false, error: "Transaction not found" },
          { status: 404 }
        );
      }

      // Update transaction status to processing
      updateTransaction(transaction.transactionId, {
        status: "completed",
      });

      // Distribute tokens to user's wallet
      console.log(`Transaction ${reference} verified. Distributing tokens...`);
      console.log(`Wallet: ${transaction.walletAddress}, Amount: ${transaction.sendAmount} SEND`);

      try {
        const distributionResult = await distributeTokens(
          transaction.transactionId,
          transaction.walletAddress,
          transaction.sendAmount
        );

        if (distributionResult.success) {
          console.log(`Tokens distributed successfully. TX Hash: ${distributionResult.txHash}`);
          return NextResponse.json({
            success: true,
            message: "Transaction processed and tokens distributed successfully",
            txHash: distributionResult.txHash,
          });
        } else {
          console.error(`Token distribution failed: ${distributionResult.error}`);
          // Still return success to Paystack (payment was successful)
          // But log the error for manual review
          return NextResponse.json({
            success: true,
            message: "Payment verified but token distribution failed",
            error: distributionResult.error,
          });
        }
      } catch (distError: any) {
        console.error("Error during token distribution:", distError);
        // Payment was successful, but token distribution failed
        // Return success to Paystack, but log error for manual intervention
        return NextResponse.json({
          success: true,
          message: "Payment verified but token distribution encountered an error",
          error: distError.message,
        });
      }
    }

    // Handle other event types if needed
    if (event.event === "charge.failed") {
      const transactionData = event.data;
      const reference = transactionData.reference;

      const transaction = getTransactionByReference(reference);
      if (transaction) {
        updateTransaction(transaction.transactionId, {
          status: "failed",
        });
      }

      return NextResponse.json({
        success: true,
        message: "Transaction marked as failed",
      });
    }

    // Acknowledge other events
    return NextResponse.json({
      success: true,
      message: "Event received",
    });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

