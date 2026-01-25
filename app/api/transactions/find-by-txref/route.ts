import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Find transaction by Flutterwave tx_ref with comprehensive search strategies
 * This endpoint tries multiple methods to find a transaction
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const txRef = searchParams.get("txRef");
    const userId = searchParams.get("userId"); // Optional: helps narrow search

    if (!txRef) {
      return NextResponse.json(
        { success: false, error: "txRef is required" },
        { status: 400 }
      );
    }

    console.log(`[Find By TxRef] Searching for transaction with txRef: ${txRef}, userId: ${userId || "not provided"}`);

    // Strategy 1: Search by payment_reference (set by webhook after processing)
    let { data: transaction, error } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("payment_reference", txRef)
      .maybeSingle();

    if (error) {
      console.error("[Find By TxRef] Error in Strategy 1:", error);
    } else if (transaction) {
      console.log(`[Find By TxRef] ✅ Found by payment_reference: ${transaction.transaction_id}`);
      return NextResponse.json({
        success: true,
        exists: true,
        transactionId: transaction.transaction_id,
        status: transaction.status,
        txHash: transaction.tx_hash,
        sendAmount: transaction.send_amount,
        error_message: transaction.error_message,
        foundBy: "payment_reference",
      });
    }

    // Strategy 2: Search by metadata->>flutterwave_tx_ref
    console.log(`[Find By TxRef] Strategy 1 failed, trying Strategy 2: metadata search`);
    const { data: metadataTransaction, error: metadataError } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("metadata->>flutterwave_tx_ref", txRef)
      .maybeSingle();

    if (metadataError) {
      console.error("[Find By TxRef] Error in Strategy 2:", metadataError);
    } else if (metadataTransaction) {
      console.log(`[Find By TxRef] ✅ Found by metadata: ${metadataTransaction.transaction_id}`);
      return NextResponse.json({
        success: true,
        exists: true,
        transactionId: metadataTransaction.transaction_id,
        status: metadataTransaction.status,
        txHash: metadataTransaction.tx_hash,
        sendAmount: metadataTransaction.send_amount,
        error_message: metadataTransaction.error_message,
        foundBy: "metadata",
      });
    }

    // Strategy 3: If userId provided, search user's recent pending transactions
    if (userId) {
      console.log(`[Find By TxRef] Strategy 2 failed, trying Strategy 3: user's recent transactions`);
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: recentTransactions, error: recentError } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "pending")
        .gte("created_at", tenMinutesAgo)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!recentError && recentTransactions && recentTransactions.length > 0) {
        // Check metadata of each transaction
        for (const tx of recentTransactions) {
          const txMetadata = tx.metadata as any;
          if (txMetadata?.flutterwave_tx_ref === txRef) {
            console.log(`[Find By TxRef] ✅ Found in user's recent transactions: ${tx.transaction_id}`);
            return NextResponse.json({
              success: true,
              exists: true,
              transactionId: tx.transaction_id,
              status: tx.status,
              txHash: tx.tx_hash,
              sendAmount: tx.send_amount,
              error_message: tx.error_message,
              foundBy: "user_recent",
            });
          }
        }
      }
    }

    // Strategy 4: Search all recent pending transactions (last 10 minutes) as last resort
    console.log(`[Find By TxRef] Strategy 3 failed, trying Strategy 4: all recent pending transactions`);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: allRecentTransactions, error: allRecentError } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("status", "pending")
      .gte("created_at", tenMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!allRecentError && allRecentTransactions && allRecentTransactions.length > 0) {
      for (const tx of allRecentTransactions) {
        const txMetadata = tx.metadata as any;
        if (txMetadata?.flutterwave_tx_ref === txRef) {
          console.log(`[Find By TxRef] ✅ Found in all recent transactions: ${tx.transaction_id}`);
          return NextResponse.json({
            success: true,
            exists: true,
            transactionId: tx.transaction_id,
            status: tx.status,
            txHash: tx.tx_hash,
            sendAmount: tx.send_amount,
            error_message: tx.error_message,
            foundBy: "all_recent",
          });
        }
      }
    }

    // Not found after all strategies
    console.log(`[Find By TxRef] ❌ Transaction not found after all strategies`);
    return NextResponse.json({
      success: true,
      exists: false,
      txRef,
      strategiesTried: ["payment_reference", "metadata", userId ? "user_recent" : null, "all_recent"].filter(Boolean),
    });
  } catch (error: any) {
    console.error("[Find By TxRef] Exception:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
