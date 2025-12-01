import { NextRequest, NextResponse } from "next/server";
import { verifyTransaction } from "@/lib/paystack";
import { getTransactionByReference, updateTransaction } from "@/lib/transactions";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const reference = searchParams.get("reference");

    if (!reference) {
      return NextResponse.json(
        { success: false, error: "Reference is required" },
        { status: 400 }
      );
    }

    // Verify transaction with Paystack
    const result = await verifyTransaction(reference);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    const transactionData = result.data;

    if (!transactionData) {
      return NextResponse.json(
        { success: false, error: "Transaction data not found" },
        { status: 404 }
      );
    }

    // Check if transaction is successful
    if (transactionData.status !== "success") {
      return NextResponse.json({
        success: false,
        status: transactionData.status,
        message: "Transaction not successful",
      });
    }

    // Update our transaction record
    const transaction = getTransactionByReference(reference);
    if (transaction) {
      updateTransaction(transaction.transactionId, {
        status: "completed",
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        status: transactionData.status,
        amount: transactionData.amount / 100, // Convert from kobo to NGN
        currency: transactionData.currency,
        reference: transactionData.reference,
        metadata: transactionData.metadata,
      },
    });
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

