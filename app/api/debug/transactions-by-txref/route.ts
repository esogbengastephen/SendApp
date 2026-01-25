import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Debug endpoint to check what transactions exist for a given tx_ref
 * Helps diagnose why callback can't find transactions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const txRef = searchParams.get("txRef");

    if (!txRef) {
      return NextResponse.json(
        { success: false, error: "txRef is required" },
        { status: 400 }
      );
    }

    console.log(`[Debug TxRef] Searching for: ${txRef}`);

    // Get all recent transactions (last 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: allRecent, error: allError } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .gte("created_at", thirtyMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(50);

    // Search by payment_reference
    const { data: byPaymentRef, error: paymentRefError } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("payment_reference", txRef)
      .maybeSingle();

    // Search by metadata
    const { data: byMetadata, error: metadataError } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("metadata->>flutterwave_tx_ref", txRef)
      .maybeSingle();

    // Search all recent for matching metadata
    const matchingRecent = allRecent?.filter(tx => {
      const txMetadata = tx.metadata as any;
      return txMetadata?.flutterwave_tx_ref === txRef;
    }) || [];

    return NextResponse.json({
      success: true,
      txRef,
      searchResults: {
        byPaymentReference: byPaymentRef ? {
          transaction_id: byPaymentRef.transaction_id,
          status: byPaymentRef.status,
          metadata: byPaymentRef.metadata,
          payment_reference: byPaymentRef.payment_reference,
        } : null,
        byMetadata: byMetadata ? {
          transaction_id: byMetadata.transaction_id,
          status: byMetadata.status,
          metadata: byMetadata.metadata,
          payment_reference: byMetadata.payment_reference,
        } : null,
        matchingInRecent: matchingRecent.map(tx => ({
          transaction_id: tx.transaction_id,
          status: tx.status,
          metadata: tx.metadata,
          payment_reference: tx.payment_reference,
          created_at: tx.created_at,
        })),
        allRecentCount: allRecent?.length || 0,
      },
      errors: {
        paymentRefError: paymentRefError?.message,
        metadataError: metadataError?.message,
        allError: allError?.message,
      },
    });
  } catch (error: any) {
    console.error("[Debug TxRef] Exception:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
