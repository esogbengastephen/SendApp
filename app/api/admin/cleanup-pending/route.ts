import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTransaction, updateTransaction } from "@/lib/transactions";
import { distributeTokens } from "@/lib/token-distribution";
import { verifyPayment } from "@/lib/flutterwave";
import { verifyPaymentForTransaction } from "@/lib/payment-verification";

type ExpiredPendingRow = {
  transaction_id: string;
  ngn_amount: number;
  send_amount: string;
  wallet_address: string;
  payment_reference: string | null;
  paystack_reference: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  expires_at: string;
};

/**
 * API Endpoint: Smart cleanup of expired pending transactions
 *
 * For each pending transaction past expires_at:
 * 1. If there is a payment reference: verify with Flutterwave or Paystack that payment was received.
 * 2. If payment was received: try to distribute tokens (idempotent – no double spend).
 * 3. If payment was not received (or no reference): delete the pending transaction.
 *
 * Can be called by: cron-job.org, Vercel Cron, or manual admin.
 * Optional auth: set CRON_SECRET and send Authorization: Bearer <secret>
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = request.headers.get("Authorization");
      const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
      if (token !== secret) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const now = new Date().toISOString();

    const { data: oldPending, error: fetchError } = await supabaseAdmin
      .from("transactions")
      .select("transaction_id, ngn_amount, send_amount, wallet_address, payment_reference, paystack_reference, metadata, created_at, expires_at")
      .eq("status", "pending")
      .lt("expires_at", now);

    if (fetchError) {
      console.error("[Cleanup Pending] Error fetching transactions:", fetchError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    const rows = (oldPending ?? []) as ExpiredPendingRow[];
    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No expired pending transactions found",
        deleted: 0,
        distributed: 0,
        skipped_no_ref: 0,
        stats: await getStats(),
      });
    }

    let deleted = 0;
    let distributed = 0;
    let skippedNoRef = 0;

    for (const tx of rows) {
      const ref =
        tx.payment_reference?.trim() ||
        tx.paystack_reference?.trim() ||
        (tx.metadata as Record<string, string> | null)?.flutterwave_tx_ref?.trim() ||
        "";

      if (!ref) {
        await deletePending(tx.transaction_id);
        deleted++;
        skippedNoRef++;
        continue;
      }

      let paymentReceived = false;

      const flw = await verifyPayment(ref);
      if (flw.success) {
        paymentReceived = true;
      }

      if (!paymentReceived) {
        const transaction = await getTransaction(tx.transaction_id);
        if (transaction) {
          const paystackResult = await verifyPaymentForTransaction(tx.transaction_id, ref);
          if (paystackResult.valid) paymentReceived = true;
        }
      }

      if (paymentReceived) {
        const walletAddress = tx.wallet_address?.trim();
        const sendAmount = tx.send_amount?.trim();
        if (walletAddress && sendAmount && parseFloat(sendAmount) > 0) {
          try {
            const result = await distributeTokens(tx.transaction_id, walletAddress, sendAmount);
            if (result.success && result.txHash) {
              distributed++;
              continue;
            }
          } catch (err) {
            console.error(`[Cleanup Pending] Distribution failed for ${tx.transaction_id}:`, err);
          }
        }
        await updateTransaction(tx.transaction_id, { status: "pending", errorMessage: "Cleanup: will retry distribution on next run" });
        continue;
      }

      await deletePending(tx.transaction_id);
      deleted++;
    }

    console.log(`[Cleanup Pending] ✅ Deleted ${deleted}, distributed ${distributed} (${skippedNoRef} had no payment ref)`);

    return NextResponse.json({
      success: true,
      message: `Processed ${rows.length} expired pending: ${distributed} distributed, ${deleted} deleted`,
      deleted,
      distributed,
      skipped_no_ref: skippedNoRef,
      stats: await getStats(),
    });
  } catch (error: unknown) {
    console.error("[Cleanup Pending] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

async function deletePending(transactionId: string): Promise<void> {
  await supabaseAdmin.from("transactions").delete().eq("transaction_id", transactionId);
}

async function getStats(): Promise<{ total: number; pending: number; completed: number; failed: number }> {
  const { data } = await supabaseAdmin.from("transactions").select("status");
  const list = data ?? [];
  return {
    total: list.length,
    pending: list.filter((t: { status: string }) => t.status === "pending").length,
    completed: list.filter((t: { status: string }) => t.status === "completed").length,
    failed: list.filter((t: { status: string }) => t.status === "failed").length,
  };
}

export async function GET(request: NextRequest) {
  try {
    const now = new Date().toISOString();

    const { data: oldPending, error: fetchError } = await supabaseAdmin
      .from("transactions")
      .select("transaction_id, ngn_amount, wallet_address, payment_reference, created_at, expires_at", { count: "exact" })
      .eq("status", "pending")
      .lt("expires_at", now)
      .limit(20);

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: oldPending?.length ?? 0,
      sample: oldPending ?? [],
      message:
        (oldPending?.length ?? 0) > 0
          ? "Expired pending transactions found. POST to run smart cleanup (verify payment → distribute or delete)."
          : "No expired pending transactions found.",
    });
  } catch (error: unknown) {
    console.error("[Cleanup Pending] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
