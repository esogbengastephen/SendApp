import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Update transaction metadata
 * Used to store Flutterwave tx_ref in transaction metadata for easier lookup
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, metadata } = body;

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    if (!metadata || typeof metadata !== "object") {
      return NextResponse.json(
        { success: false, error: "Metadata must be an object" },
        { status: 400 }
      );
    }

    console.log(`[Update Metadata] Updating transaction ${transactionId} with metadata:`, metadata);

    // Get existing transaction to merge metadata
    const { data: existingTransaction, error: fetchError } = await supabaseAdmin
      .from("transactions")
      .select("metadata")
      .eq("transaction_id", transactionId)
      .maybeSingle();

    if (fetchError) {
      console.error("[Update Metadata] Error fetching transaction:", fetchError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch transaction" },
        { status: 500 }
      );
    }

    if (!existingTransaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Merge existing metadata with new metadata
    const existingMetadata = (existingTransaction.metadata as any) || {};
    const mergedMetadata = {
      ...existingMetadata,
      ...metadata,
    };

    // Update transaction with merged metadata
    const { data: updatedTransaction, error: updateError } = await supabaseAdmin
      .from("transactions")
      .update({
        metadata: mergedMetadata,
      })
      .eq("transaction_id", transactionId)
      .select()
      .single();

    if (updateError) {
      console.error("[Update Metadata] Error updating transaction:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update transaction metadata" },
        { status: 500 }
      );
    }

    console.log(`[Update Metadata] ✅ Successfully updated transaction ${transactionId}`);
    return NextResponse.json({
      success: true,
      transactionId,
      metadata: mergedMetadata,
    });
  } catch (error: any) {
    console.error("[Update Metadata] Exception:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
