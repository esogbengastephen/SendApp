import { NextRequest, NextResponse } from "next/server";
import { generateChallenge } from "@/lib/passkey";

export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    // Generate challenge
    const challenge = generateChallenge();

    // Store challenge temporarily (in production, use Redis or similar)
    // For now, we'll return it directly
    // In production, store with expiration and verify on verify endpoint

    return NextResponse.json({
      success: true,
      challenge,
    });
  } catch (error: any) {
    console.error("Error generating challenge:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

