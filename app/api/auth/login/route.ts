import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/auth";
import { generateSessionToken } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if user exists
    const userResult = await getUserByEmail(email);
    if (!userResult.success) {
      return NextResponse.json(
        { success: false, error: "User doesn't exist. Please sign up." },
        { status: 404 }
      );
    }

    // User exists - generate session token and return user
    const sessionToken = generateSessionToken();
    
    console.log(`[Login] ✅ User ${email} logged in successfully`);
    
    // Set httpOnly cookie
    const response = NextResponse.json({
      success: true,
      user: userResult.user,
      message: "Login successful",
    });

    response.cookies.set("auth_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Error logging in:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

