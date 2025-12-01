import { NextRequest, NextResponse } from "next/server";
import { sendConfirmationCode, getUserByEmail } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if user already exists (for signup flow)
    const userCheck = await getUserByEmail(email);
    if (userCheck.success && userCheck.user) {
      return NextResponse.json(
        { 
          success: false, 
          error: "User already exists. Please login.",
          userExists: true 
        },
        { status: 400 }
      );
    }

    const result = await sendConfirmationCode(email);

    if (!result.success) {
      console.error("Failed to send confirmation code:", result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Send email with the confirmation code
    if ('code' in result && result.code) {
      console.log(`[Send Code] Attempting to send email to ${email} with code ${result.code}`);
      
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
          console.error("[Send Code] Email sending failed:", emailData);
          console.error("[Send Code] Response status:", emailResponse.status);
          // Still return success because code was generated and stored
          // User can see the code in console for development or request a new one
          return NextResponse.json({
            success: true,
            message: "Confirmation code generated. Check server console for the code if email failed.",
            code: process.env.NODE_ENV === "development" ? result.code : undefined, // Only show in dev
            emailSent: false,
            emailError: emailData.error || "Email sending failed",
          });
        }
        
        console.log(`[Send Code] ✅ Email sent successfully to ${email}`);
        return NextResponse.json({
          success: true,
          message: "Confirmation code sent to your email",
          emailSent: true,
        });
      } catch (emailError: any) {
        console.error("[Send Code] Error calling email API:", emailError);
        // Code is still stored, so return success but indicate email issue
        return NextResponse.json({
          success: true,
          message: "Confirmation code generated. Email sending failed - check server logs.",
          code: process.env.NODE_ENV === "development" ? result.code : undefined,
          emailSent: false,
          emailError: emailError.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Confirmation code sent to your email",
    });
  } catch (error: any) {
    console.error("Error sending confirmation code:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

