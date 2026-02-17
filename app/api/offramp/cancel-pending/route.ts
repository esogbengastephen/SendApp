import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/offramp/cancel-pending
 *
 * Cancel the current user's pending off-ramp(s) so they can start a new one.
 * Body: { userEmail }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { userEmail } = body as { userEmail?: string };

    if (!userEmail || typeof userEmail !== "string" || !userEmail.trim()) {
      return NextResponse.json(
        { success: false, error: "User email is required." },
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

    // Use "failed" so we satisfy the DB check constraint (status may not allow "cancelled").
    // Cron only processes status = 'pending', so these rows are ignored.
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("offramp_transactions")
      .update({
        status: "failed",
        error_message: "Cancelled by user",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("status", "pending")
      .select("transaction_id");

    if (updateError) {
      console.error("[Offramp cancel-pending] Update error:", updateError.code, updateError.message, updateError.details);
      const hint =
        updateError.code === "PGRST301" || updateError.message?.includes("policy")
          ? " Check that SUPABASE_SERVICE_ROLE_KEY is set so server can update off-ramp rows."
          : "";
      return NextResponse.json(
        {
          success: false,
          error: `Failed to cancel pending off-ramp.${hint}`,
          ...(process.env.NODE_ENV === "development" && { detail: updateError.message }),
        },
        { status: 500 }
      );
    }

    const count = updated?.length ?? 0;
    return NextResponse.json({
      success: true,
      message: count > 0 ? "Pending off-ramp cancelled. You can start a new one." : "No pending off-ramp found.",
      cancelled: count,
    });
  } catch (err: unknown) {
    console.error("[Offramp cancel-pending] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Something went wrong.",
      },
      { status: 500 }
    );
  }
}
