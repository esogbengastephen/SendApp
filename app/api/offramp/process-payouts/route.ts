import { NextRequest, NextResponse } from "next/server";
import { processPendingOfframpPayouts } from "@/lib/offramp-sweep-payout";

/** Allow long run for multiple sweep+payouts (Vercel Pro: up to 300s). */
export const maxDuration = 300;

/**
 * POST /api/offramp/process-payouts
 *
 * Sweep + payout: for each pending Base off-ramp with SEND at its deposit address,
 * sweep SEND to pool and send NGN via Flutterwave.
 *
 * Call by:
 * - Vercel Cron (add path to vercel.json crons)
 * - External cron (e.g. cron-job.org) with optional auth
 * - Manual trigger (admin or support)
 *
 * Optional auth: set OFFRAMP_CRON_SECRET and send Authorization: Bearer <secret>
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
    console.error("[Offramp process-payouts] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Processing failed",
      },
      { status: 500 }
    );
  }
}
