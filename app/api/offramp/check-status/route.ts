import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Check status of off-ramp transaction
 * GET /api/offramp/check-status?transactionId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const transactionId = searchParams.get("transactionId");

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
    const { data: transaction, error } = await supabaseAdmin
      .from("offramp_transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single();

    if (error || !transaction) {
      return NextResponse.json(
        {
          success: false,
          message: "Transaction not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      status: transaction.status,
      ngnAmount: transaction.ngn_amount,
      errorMessage: transaction.error_message,
      paystackReference: transaction.paystack_reference,
      // Add timestamps
      createdAt: transaction.created_at,
      tokenReceivedAt: transaction.token_received_at,
      usdcReceivedAt: transaction.usdc_received_at,
      paidAt: transaction.paid_at,
      updatedAt: transaction.updated_at,
    });
  } catch (error) {
    console.error("[OffRamp] Error checking status:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "An error occurred",
      },
      { status: 500 }
    );
  }
}

