import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if user exists in database
    const userResult = await getUserByEmail(email);
    
    if (!userResult.success || !userResult.user) {
      return NextResponse.json(
        { success: false, exists: false, error: "User not found in database" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      exists: true,
      user: userResult.user,
    });
  } catch (error: any) {
    console.error("Error verifying user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify user", details: error.message },
      { status: 500 }
    );
  }
}

