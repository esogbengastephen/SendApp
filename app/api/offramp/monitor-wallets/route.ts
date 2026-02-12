import { NextRequest, NextResponse } from "next/server";
import { processPendingOfframpPayouts } from "@/lib/offramp-sweep-payout";

/**
 * POST /api/offramp/monitor-wallets
 *
 * Wallet watcher (Option B – unified): runs the same logic as process-payouts.
 * For each pending off-ramp with SEND at its deposit address, sweeps to pool
 * and pays NGN via Flutterwave. Use this as the single "monitor + process" cron.
 *
 * Call by:
 * - External cron (e.g. cron-job.org) – same schedule as or instead of process-payouts
 * - Optional auth: set OFFRAMP_CRON_SECRET and send Authorization: Bearer <secret>
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.OFFRAMP_CRON_SECRET;
    if (secret) {
      const auth = request.headers.get("Authorization");
      const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
      if (token !== secret) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const result = await processPendingOfframpPayouts();

    return NextResponse.json({
      success: true,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      results: result.results,
    });
  } catch (err: unknown) {
    console.error("[Offramp monitor-wallets] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Processing failed",
      },
      { status: 500 }
    );
  }
}
