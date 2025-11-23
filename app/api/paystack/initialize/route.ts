import { NextRequest, NextResponse } from "next/server";
import { createTransaction } from "@/lib/transactions";
import { isValidWalletOrTag, isValidAmount } from "@/utils/validation";

/**
 * Store transaction without initializing Paystack payment
 * This endpoint just stores the transaction with the unique ID generated on page load
 * The transaction ID links: wallet address + payment amount + payment verification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ngnAmount, sendAmount, walletAddress, transactionId } = body;

    // Validate inputs
    if (!ngnAmount || !isValidAmount(ngnAmount.toString())) {
      return NextResponse.json(
        { success: false, error: "Invalid NGN amount" },
        { status: 400 }
      );
    }

    if (!walletAddress || !isValidWalletOrTag(walletAddress.trim())) {
      return NextResponse.json(
        { success: false, error: "Invalid wallet address or SendTag" },
        { status: 400 }
      );
    }

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    // Store transaction in our system using the unique transaction ID
    // This ID was generated when the page loaded and will be used to:
    // 1. Link the wallet address the user provided
    // 2. Verify the payment amount when checking Paystack
    // 3. Distribute tokens to the correct wallet
    createTransaction({
      transactionId,
      paystackReference: transactionId, // Use transaction ID as reference (will be updated when payment is found)
      ngnAmount: parseFloat(ngnAmount),
      sendAmount,
      walletAddress: walletAddress.trim(),
    });

    console.log(`Transaction stored: ${transactionId} for wallet ${walletAddress.trim()}, amount: ${ngnAmount} NGN = ${sendAmount} SEND`);

    return NextResponse.json({
      success: true,
      message: "Transaction stored successfully",
      data: {
        transactionId,
      },
    });
  } catch (error: any) {
    console.error("Transaction storage error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

