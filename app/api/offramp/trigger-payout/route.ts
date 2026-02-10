import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { processOneOfframpPayout, type OfframpRow } from "@/lib/offramp-sweep-payout";

/**
 * POST /api/offramp/trigger-payout
 *
 * User-triggered: "I have transferred" — process this transaction now (sweep SEND to pool + Flutterwave NGN).
 * Body: { transactionId, userEmail }
 * Verifies the transaction belongs to the user, then runs the same sweep + payout as the cron.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { transactionId, userEmail } = body as { transactionId?: string; userEmail?: string };

    if (!transactionId || !userEmail) {
      return NextResponse.json(
        { success: false, error: "Transaction ID and email are required." },
        { status: 400 }
      );
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", userEmail.trim())
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    const userId = userData.id;

    const { data: row, error: rowError } = await supabaseAdmin
      .from("offramp_transactions")
      .select("id, transaction_id, user_id, deposit_address, deposit_private_key_encrypted, account_number, account_name, bank_code, network, status")
      .eq("transaction_id", transactionId.trim())
      .eq("user_id", userId)
      .single();

    if (rowError || !row) {
      return NextResponse.json(
        { success: false, error: "Transaction not found or you do not own it." },
        { status: 404 }
      );
    }

    if (row.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: `Transaction is already ${row.status}. No need to process again.`,
        },
        { status: 400 }
      );
    }

    const result = await processOneOfframpPayout(row as OfframpRow);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Processing complete. Naira has been sent to your bank account.",
        transactionId: result.transactionId,
        sendAmount: result.sendAmount,
        ngnAmount: result.ngnAmount,
        sweepTxHash: result.sweepTxHash,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: result.error || "Processing failed. You can try again or wait for the automatic payout.",
      },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error("[Offramp trigger-payout] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Something went wrong.",
      },
      { status: 500 }
    );
  }
}
