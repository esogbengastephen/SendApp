import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserFromStorage } from "@/lib/session";

/**
 * POST - Mark all notifications as read for the current user
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromStorage();
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Mark all unread notifications as read
    const { error: updateError } = await supabaseAdmin
      .from("notifications")
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("read", false);

    if (updateError) {
      console.error("Error marking all notifications as read:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update notifications" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error: any) {
    console.error("Error in POST /api/notifications/read-all:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
