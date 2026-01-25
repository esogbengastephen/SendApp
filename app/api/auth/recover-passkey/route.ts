import { NextRequest, NextResponse } from "next/server";
import { sendConfirmationCode, verifyConfirmationCode, getUserByEmail } from "@/lib/auth";

/**
 * Send recovery code for passkey recovery
 * This allows existing users to recover their account by email verification
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

    // Check if user exists (must exist for recovery)
    const userCheck = await getUserByEmail(email);
    if (!userCheck.success || !userCheck.user) {
      return NextResponse.json(
        { 
          success: false, 
          error: "No account found with this email. Please sign up first.",
        },
        { status: 404 }
      );
    }

    // Send confirmation code for recovery
    const result = await sendConfirmationCode(email);

    if (!result.success) {
      console.error("Failed to send recovery code:", result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Send email with the confirmation code
    if ('code' in result && result.code) {
      console.log(`[Recover Passkey] Attempting to send recovery email to ${email} with code ${result.code}`);
      
      try {
        const emailResponse = await fetch(
          `${request.nextUrl.origin}/api/auth/send-email`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code: result.code }),
          }
        );

        const emailData = await emailResponse.json();
        
        if (!emailResponse.ok) {
          return NextResponse.json({
            success: true,
            message: "Recovery code generated. Check server console for the code if email failed.",
            code: process.env.NODE_ENV === "development" ? result.code : undefined,
            emailSent: false,
          });
        }
        
        return NextResponse.json({
          success: true,
          message: "Recovery code sent to your email",
          emailSent: true,
        });
      } catch (emailError: any) {
        return NextResponse.json({
          success: true,
          message: "Recovery code generated. Email sending failed.",
          code: process.env.NODE_ENV === "development" ? result.code : undefined,
          emailSent: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Recovery code sent to your email",
    });
  } catch (error: any) {
    console.error("Error sending recovery code:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Verify recovery code and return user for passkey recreation
 */
export async function PUT(request: NextRequest) {
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
    if (!userResult.success || !userResult.user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: userResult.user,
      message: "Recovery code verified. You can now create a new passkey.",
    });
  } catch (error: any) {
    console.error("Error verifying recovery code:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
