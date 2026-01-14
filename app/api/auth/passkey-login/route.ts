import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Check if user has passkey and return user info for passkey authentication
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    // Get user by email
    const userResult = await getUserByEmail(email);
    if (!userResult.success || !userResult.user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const userId = userResult.user.id;

    // Check if user has passkey
    const { data: userData, error } = await supabaseAdmin
      .from("users")
      .select("passkey_credential_id")
      .eq("id", userId)
      .single();

    if (error || !userData?.passkey_credential_id) {
      return NextResponse.json({
        success: false,
        hasPasskey: false,
        error: "No passkey found for this user",
      });
    }

    // User has passkey - return user info for client-side authentication
    return NextResponse.json({
      success: true,
      hasPasskey: true,
      user: userResult.user,
      userId,
    });
  } catch (error: any) {
    console.error("Error checking passkey login:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

