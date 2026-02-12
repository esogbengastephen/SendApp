import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/** Delete read notifications older than this many days. */
const DEFAULT_RETENTION_DAYS = 90;

/**
 * POST /api/admin/cleanup-old-notifications
 *
 * Deletes read notifications older than 90 days (configurable via query ?days=90).
 * Keeps the notifications table from growing indefinitely.
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

    const { searchParams } = new URL(request.url);
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") ?? String(DEFAULT_RETENTION_DAYS), 10) || DEFAULT_RETENTION_DAYS));
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: toDelete, error: fetchError } = await supabaseAdmin
      .from("notifications")
      .select("id")
      .eq("read", true)
      .lt("created_at", cutoff);

    if (fetchError) {
      console.error("[Cleanup Old Notifications] Error fetching:", fetchError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch notifications" },
        { status: 500 }
      );
    }

    if (!toDelete?.length) {
      return NextResponse.json({
        success: true,
        message: `No read notifications older than ${days} days`,
        deleted: 0,
        retention_days: days,
      });
    }

    const ids = toDelete.map((n) => n.id);
    const { error: deleteError } = await supabaseAdmin
      .from("notifications")
      .delete()
      .in("id", ids);

    if (deleteError) {
      console.error("[Cleanup Old Notifications] Error deleting:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to delete notifications" },
        { status: 500 }
      );
    }

    console.log(`[Cleanup Old Notifications] Deleted ${ids.length} read notification(s) older than ${days} days`);

    return NextResponse.json({
      success: true,
      message: `Deleted ${ids.length} read notification(s) older than ${days} days`,
      deleted: ids.length,
      retention_days: days,
    });
  } catch (err: unknown) {
    console.error("[Cleanup Old Notifications] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
