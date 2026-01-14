import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserFromStorage } from "@/lib/session";

/**
 * POST - Mark a notification as read
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromStorage();
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const notificationId = params.id;

    // Verify the notification belongs to the user
    const { data: notification, error: fetchError } = await supabaseAdmin
      .from("notifications")
      .select("id, user_id, read")
      .eq("id", notificationId)
      .single();

    if (fetchError || !notification) {
      return NextResponse.json(
        { success: false, error: "Notification not found" },
        { status: 404 }
      );
    }

    if (notification.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Mark as read
    const { error: updateError } = await supabaseAdmin
      .from("notifications")
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", notificationId);

    if (updateError) {
      console.error("Error marking notification as read:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update notification" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error: any) {
    console.error("Error in POST /api/notifications/[id]/read:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
