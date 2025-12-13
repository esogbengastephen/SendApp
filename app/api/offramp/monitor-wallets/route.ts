import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Monitor wallets for pending off-ramp transactions
 * This endpoint should be called periodically (via cron job) to:
 * 1. Check pending transactions for incoming tokens
 * 2. Trigger swaps for token_received transactions
 * 3. Trigger payments for usdc_received transactions
 * 
 * GET /api/offramp/monitor-wallets
 */
export async function GET(request: NextRequest) {
  try {
    // Get all pending transactions
    const { data: pendingTransactions, error: pendingError } = await supabaseAdmin
      .from("offramp_transactions")
      .select("*")
      .in("status", ["pending", "token_received", "swapping", "usdc_received"])
      .order("created_at", { ascending: true })
      .limit(50); // Process up to 50 at a time

    if (pendingError) {
      console.error("[Monitor Wallets] Error fetching pending transactions:", pendingError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch pending transactions",
        },
        { status: 500 }
      );
    }

    const results = {
      checked: 0,
      tokenDetected: 0,
      swapsTriggered: 0,
      paymentsTriggered: 0,
      errors: [] as string[],
    };

    for (const transaction of pendingTransactions || []) {
      results.checked++;

      try {
        // For pending transactions, check for tokens
        if (transaction.status === "pending") {
          const checkResponse = await fetch(`${request.nextUrl.origin}/api/offramp/check-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactionId: transaction.transaction_id }),
          });

          const checkData = await checkResponse.json();
          if (checkData.success && checkData.tokenDetected) {
            results.tokenDetected++;
            console.log(`[Monitor] Token detected for ${transaction.transaction_id}`);
          }
        }

        // For token_received, empty wallet completely (swap all tokens, recover ETH)
        if (transaction.status === "token_received" && !transaction.wallet_emptied) {
          // Check swap attempts (max 3)
          if ((transaction.swap_attempts || 0) < 3) {
            // Use new empty-wallet endpoint to completely empty the wallet
            const emptyResponse = await fetch(`${request.nextUrl.origin}/api/offramp/empty-wallet`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transactionId: transaction.transaction_id }),
            });

            const emptyData = await emptyResponse.json();
            if (emptyData.success) {
              results.swapsTriggered++;
              console.log(`[Monitor] Wallet emptied for ${transaction.transaction_id}. Swapped ${emptyData.tokensSwapped} token(s), USDC: ${emptyData.totalUSDCReceived}`);
            } else {
              results.errors.push(`Wallet emptying failed for ${transaction.transaction_id}: ${emptyData.message || emptyData.errors?.join(", ")}`);
              
              // Increment swap attempts
              await supabaseAdmin
                .from("offramp_transactions")
                .update({
                  swap_attempts: (transaction.swap_attempts || 0) + 1,
                  updated_at: new Date().toISOString(),
                })
                .eq("transaction_id", transaction.transaction_id);
            }
          } else {
            // Max attempts reached, mark for manual review
            await supabaseAdmin
              .from("offramp_transactions")
              .update({
                status: "failed",
                error_message: "Wallet emptying failed after 3 attempts. Manual review required.",
                updated_at: new Date().toISOString(),
              })
              .eq("transaction_id", transaction.transaction_id);

            results.errors.push(`Max wallet emptying attempts reached for ${transaction.transaction_id}`);
          }
        }

        // For usdc_received, trigger payment
        if (transaction.status === "usdc_received") {
          const paymentResponse = await fetch(`${request.nextUrl.origin}/api/offramp/process-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactionId: transaction.transaction_id }),
          });

          const paymentData = await paymentResponse.json();
          if (paymentData.success) {
            results.paymentsTriggered++;
            console.log(`[Monitor] Payment triggered for ${transaction.transaction_id}`);
          } else {
            results.errors.push(`Payment failed for ${transaction.transaction_id}: ${paymentData.message}`);
          }
        }
      } catch (error: any) {
        results.errors.push(`Error processing ${transaction.transaction_id}: ${error.message}`);
        console.error(`[Monitor] Error processing transaction ${transaction.transaction_id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Monitoring completed",
      results,
    });
  } catch (error: any) {
    console.error("[Monitor Wallets] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

