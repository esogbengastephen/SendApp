import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import {
  getTransactionByReference,
  updateTransaction,
  isTransactionProcessed,
  calculateSendAmount,
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
      const paystackAmount = transactionData.amount / 100; // Convert from kobo to NGN

      // Check if transaction has already been processed
      if (isTransactionProcessed(reference)) {
        console.log(`Transaction ${reference} already processed`);
        return NextResponse.json({ success: true, message: "Already processed" });
      }

      // Get our transaction record
      let transaction = getTransactionByReference(reference);
      
      // If not found by reference, try to find by amount + timestamp
      if (!transaction) {
        console.log(`Transaction not found by reference ${reference}, trying to match by amount and timestamp...`);
        // This will be handled in process-payment endpoint
        return NextResponse.json(
          { success: false, error: "Transaction not found. User should claim via payment form." },
          { status: 404 }
        );
      }

      // Verify NGN amount matches
      if (Math.abs(transaction.ngnAmount - paystackAmount) > 0.01) {
        console.error(`Amount mismatch: Transaction has ${transaction.ngnAmount} NGN, Paystack has ${paystackAmount} NGN`);
        return NextResponse.json(
          { success: false, error: "Amount mismatch between transaction and Paystack payment" },
          { status: 400 }
        );
      }

      // Recalculate sendAmount if exchangeRate is stored (in case rate changed)
      let finalSendAmount = transaction.sendAmount;
      if (transaction.exchangeRate) {
        const recalculated = calculateSendAmount(transaction.ngnAmount, transaction.exchangeRate);
        finalSendAmount = recalculated;
        console.log(`Recalculated sendAmount: ${finalSendAmount} SEND (from rate ${transaction.exchangeRate})`);
      }

      // Update transaction with both amounts and status
      updateTransaction(transaction.transactionId, {
        status: "completed",
        ngnAmount: paystackAmount, // Use Paystack amount as source of truth
        sendAmount: finalSendAmount, // Use recalculated amount
        paystackReference: reference,
        completedAt: new Date(),
      });

      // Distribute tokens to user's wallet
      console.log(`Transaction ${reference} verified. Distributing tokens...`);
      console.log(`Wallet: ${transaction.walletAddress}, Amount: ${finalSendAmount} SEND`);

      try {
        const distributionResult = await distributeTokens(
          transaction.transactionId,
          transaction.walletAddress,
          finalSendAmount
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
          return NextResponse.json({
            success: true,
            message: "Payment verified but token distribution failed",
            error: distributionResult.error,
          });
        }
      } catch (distError: any) {
        console.error("Error during token distribution:", distError);
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

