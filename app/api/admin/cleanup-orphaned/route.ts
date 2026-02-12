import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/admin/cleanup-orphaned
 *
 * Removes orphaned pending transactions:
 * - ₦0 amount
 * - Empty or placeholder wallet address
 * - Pending > 24 hours with very small amount (likely test)
 *
 * Call by: Vercel Cron, cron-job.org, or manual admin.
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

    const { data: allPending, error: fetchError } = await supabaseAdmin
      .from("transactions")
      .select("transaction_id, ngn_amount, wallet_address, created_at")
      .eq("status", "pending");

    if (fetchError) {
      console.error("[Cleanup Orphaned] Error fetching:", fetchError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    if (!allPending?.length) {
      return NextResponse.json({
        success: true,
        message: "No pending transactions found",
        deleted: 0,
        transaction_ids: [],
      });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const orphaned = allPending.filter((tx) => {
      const amount = parseFloat(String(tx.ngn_amount ?? 0));
      const wallet = (tx.wallet_address ?? "").trim();
      const createdAt = new Date(tx.created_at);
      const isOld = createdAt < oneDayAgo;
      return (
        amount === 0 ||
        !wallet ||
        wallet === "..." ||
        (isOld && amount < 50)
      );
    });

    if (orphaned.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No orphaned transactions found",
        deleted: 0,
        transaction_ids: [],
      });
    }

    let deleted = 0;
    const transactionIds: string[] = [];

    for (const tx of orphaned) {
      const { error } = await supabaseAdmin
        .from("transactions")
        .delete()
        .eq("transaction_id", tx.transaction_id);
      if (!error) {
        deleted++;
        transactionIds.push(tx.transaction_id);
      }
    }

    console.log(`[Cleanup Orphaned] Deleted ${deleted} orphaned transaction(s)`);

    return NextResponse.json({
      success: true,
      message: `Deleted ${deleted} orphaned transaction(s)`,
      deleted,
      transaction_ids: transactionIds,
    });
  } catch (err: unknown) {
    console.error("[Cleanup Orphaned] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
