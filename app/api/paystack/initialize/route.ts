import { NextRequest, NextResponse } from "next/server";
import { initializeTransaction } from "@/lib/paystack";
import { createTransaction } from "@/lib/transactions";
import { isValidWalletOrTag, isValidAmount } from "@/utils/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ngnAmount, sendAmount, walletAddress, transactionId, email } = body;

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

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid email is required" },
        { status: 400 }
      );
    }

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    // Convert NGN to kobo (Paystack uses kobo as the smallest unit)
    const amountInKobo = Math.round(parseFloat(ngnAmount) * 100);

    // Get callback URL
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/payment/callback`;

    // Initialize Paystack transaction
    const result = await initializeTransaction({
      email,
      amount: amountInKobo,
      reference: transactionId, // Use our transaction ID as Paystack reference
      callback_url: callbackUrl,
      metadata: {
        transactionId,
        ngnAmount: parseFloat(ngnAmount),
        sendAmount,
        walletAddress: walletAddress.trim(),
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Store transaction in our system
    createTransaction({
      transactionId,
      paystackReference: result.data.reference,
      ngnAmount: parseFloat(ngnAmount),
      sendAmount,
      walletAddress: walletAddress.trim(),
    });

    return NextResponse.json({
      success: true,
      data: {
        authorizationUrl: result.data.authorization_url,
        accessCode: result.data.access_code,
        reference: result.data.reference,
      },
    });
  } catch (error: any) {
    console.error("Payment initialization error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

