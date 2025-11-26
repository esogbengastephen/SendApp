import { NextRequest, NextResponse } from "next/server";
import { createUser, verifyConfirmationCode } from "@/lib/auth";
import { generateSessionToken } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const { email, code, referralCode } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { success: false, error: "Email and confirmation code are required" },
        { status: 400 }
      );
    }

    // Verify confirmation code first
    const verifyResult = await verifyConfirmationCode(email, code);
    if (!verifyResult.success) {
      return NextResponse.json(
        { success: false, error: verifyResult.error },
        { status: 400 }
      );
    }

    // Create user account
    const result = await createUser(email, referralCode);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Generate session token
    const sessionToken = generateSessionToken();
    
    console.log(`[Signup] ✅ User ${email} created successfully`);
    
    // Send referral code email after successful signup
    if (result.user?.referralCode) {
      try {
        const emailResponse = await fetch(
          `${request.nextUrl.origin}/api/auth/send-referral-email`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              email, 
              referralCode: result.user.referralCode 
            }),
          }
        );
        
        if (emailResponse.ok) {
          console.log(`[Signup] ✅ Referral code email sent to ${email}`);
        } else {
          console.error(`[Signup] ⚠️ Failed to send referral code email`);
        }
      } catch (emailError) {
        console.error(`[Signup] Error sending referral code email:`, emailError);
        // Don't fail signup if email fails
      }
    }
    
    // Set httpOnly cookie
    const response = NextResponse.json({
      success: true,
      user: result.user,
      message: "Account created successfully",
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
    console.error("Error signing up:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

