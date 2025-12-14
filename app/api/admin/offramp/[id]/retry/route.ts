import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminWallet } from "@/lib/supabase";

/**
 * Retry swap for a failed off-ramp transaction (Admin only)
 * POST /api/admin/offramp/[id]/retry
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { adminWallet } = body;
    const transactionId = params.id;

    // Verify admin access
    if (!adminWallet) {
      return NextResponse.json(
        { success: false, error: "Admin wallet address required" },
        { status: 400 }
      );
    }

    const isAdmin = await isAdminWallet(adminWallet);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    // Get transaction
    const { data: transaction, error: txError } = await supabaseAdmin
      .from("offramp_transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single();

    if (txError || !transaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Check if transaction can be retried
    if (transaction.status === "completed") {
      return NextResponse.json(
        { success: false, error: "Transaction already completed" },
        { status: 400 }
      );
    }

    // Reset status to token_received to allow retry
    const { error: updateError } = await supabaseAdmin
      .from("offramp_transactions")
      .update({
        status: "token_received",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("transaction_id", transactionId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Failed to update transaction" },
        { status: 500 }
      );
    }

    // Actually trigger the swap by calling the swap-token endpoint
    try {
      const swapResponse = await fetch(`${request.nextUrl.origin}/api/offramp/swap-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
      });

      const swapData = await swapResponse.json();
      
      if (swapData.success) {
        return NextResponse.json({
          success: true,
          message: "Swap triggered successfully",
          swapTxHash: swapData.swapTxHash,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: swapData.message || "Failed to trigger swap",
        }, { status: 500 });
      }
    } catch (error: any) {
      console.error("[Admin OffRamp Retry] Error triggering swap:", error);
      return NextResponse.json({
        success: false,
        error: "Failed to trigger swap",
        message: "Transaction status was reset, but swap trigger failed. Please trigger swap manually.",
        details: error.message,
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[Admin OffRamp Retry] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

