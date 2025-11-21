import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import {
  getTransactionByReference,
  updateTransaction,
  isTransactionProcessed,
} from "@/lib/transactions";

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

      // Update transaction status
      updateTransaction(transaction.transactionId, {
        status: "completed",
      });

      // TODO: Trigger token distribution here
      // This will be implemented in Phase 4 (Blockchain Integration)
      console.log(`Transaction ${reference} verified. Ready for token distribution.`);
      console.log(`Wallet: ${transaction.walletAddress}, Amount: ${transaction.sendAmount} SEND`);

      return NextResponse.json({
        success: true,
        message: "Transaction processed successfully",
      });
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

