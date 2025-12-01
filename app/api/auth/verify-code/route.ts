import { NextRequest, NextResponse } from "next/server";
import { verifyConfirmationCode } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { success: false, error: "Email and code are required" },
        { status: 400 }
      );
    }

    const result = await verifyConfirmationCode(email, code);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Code verified successfully",
    });
  } catch (error: any) {
    console.error("Error verifying code:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

