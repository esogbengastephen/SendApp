import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, verifyConfirmationCode } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { success: false, error: "Email and code are required" },
        { status: 400 }
      );
    }

    // Verify confirmation code
    const verifyResult = await verifyConfirmationCode(email, code);
    if (!verifyResult.success) {
      return NextResponse.json(
        { success: false, error: verifyResult.error },
        { status: 400 }
      );
    }

    // Get user
    const userResult = await getUserByEmail(email);
    if (!userResult.success) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: userResult.user,
      message: "Login successful",
    });
  } catch (error: any) {
    console.error("Error verifying login:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

