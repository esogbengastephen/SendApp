import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { userId, action, reason } = await request.json();

    if (!userId || !action) {
      return NextResponse.json(
        { success: false, error: "User ID and action are required" },
        { status: 400 }
      );
    }

    const validActions = ["block", "unblock", "reset", "clear_reset"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 }
      );
    }

    // Get user info first
    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("email, is_blocked, requires_reset")
      .eq("id", userId)
      .single();

    if (fetchError || !user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    let updateData: any = {};
    let message = "";

    switch (action) {
      case "block":
        updateData = {
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          blocked_reason: reason || "Blocked by administrator",
        };
        message = `User ${user.email} has been blocked`;
        break;

      case "unblock":
        updateData = {
          is_blocked: false,
          blocked_at: null,
          blocked_reason: null,
        };
        message = `User ${user.email} has been unblocked`;
        break;

      case "reset":
        updateData = {
          requires_reset: true,
          reset_requested_at: new Date().toISOString(),
        };
        message = `Account reset requested for ${user.email}. User will need to re-setup on next login.`;
        break;

      case "clear_reset":
        updateData = {
          requires_reset: false,
          reset_requested_at: null,
        };
        message = `Reset flag cleared for ${user.email}`;
        break;
    }

    // Update user in database
    const { error: updateError } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating user:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update user" },
        { status: 500 }
      );
    }

    // TODO: Send email notification to user
    // You can implement email notification here using your email service

    console.log(`[Admin] User management action: ${action} on ${user.email}`);

    return NextResponse.json({
      success: true,
      message,
      user: {
        email: user.email,
        ...updateData,
      },
    });
  } catch (error: any) {
    console.error("Error in user management API:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

