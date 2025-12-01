import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

/**
 * Test endpoint to verify Gmail SMTP is working
 * Usage: POST /api/auth/test-email with { "email": "your@email.com" }
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

    const GMAIL_USER = process.env.GMAIL_USER;
    const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
    const FROM_EMAIL = process.env.GMAIL_FROM_EMAIL || GMAIL_USER;

    console.log("\n🧪 [TEST EMAIL] Starting Gmail SMTP test...");
    console.log(`[TEST EMAIL] To: ${email}`);
    console.log(`[TEST EMAIL] GMAIL_USER: ${GMAIL_USER ? 'Set (' + GMAIL_USER + ')' : 'NOT SET'}`);
    console.log(`[TEST EMAIL] GMAIL_APP_PASSWORD: ${GMAIL_APP_PASSWORD ? 'Set' : 'NOT SET'}`);
    console.log(`[TEST EMAIL] FROM_EMAIL: ${FROM_EMAIL}`);

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      return NextResponse.json({
        success: false,
        error: "Gmail SMTP is not configured in .env.local",
        details: "Please add GMAIL_USER and GMAIL_APP_PASSWORD to your .env.local file and restart the server",
        instructions: "See GMAIL_SMTP_SETUP.md for detailed setup instructions",
      }, { status: 400 });
    }

    // Create Gmail SMTP transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });

    // Verify transporter
    console.log(`[TEST EMAIL] Verifying SMTP connection...`);
    try {
      await transporter.verify();
      console.log(`[TEST EMAIL] ✅ SMTP server is ready`);
    } catch (verifyError: any) {
      console.error(`[TEST EMAIL] ❌ SMTP verification failed:`, verifyError);
      return NextResponse.json({
        success: false,
        error: `SMTP verification failed: ${verifyError.message}`,
        details: "Please check your GMAIL_USER and GMAIL_APP_PASSWORD",
      }, { status: 500 });
    }

    const testCode = "123456";
    const htmlEmail = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Test Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #34ff4d;">Test Email from Send Token Platform</h2>
          <p>If you received this email, your Gmail SMTP configuration is working!</p>
          <p>Test code: <strong style="font-size: 24px; color: #34ff4d;">${testCode}</strong></p>
        </body>
      </html>
    `;

    console.log(`[TEST EMAIL] Sending test email via Gmail SMTP...`);
    
    const mailOptions = {
      from: `"Send Token Platform" <${FROM_EMAIL}>`,
      to: email,
      subject: "Test Email - Send Token Platform",
      html: htmlEmail,
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`[TEST EMAIL] ✅ Email sent successfully!`);
    console.log(`[TEST EMAIL] Message ID: ${info.messageId}`);
    console.log(`[TEST EMAIL] Response: ${info.response}`);

    return NextResponse.json({
      success: true,
      message: "Test email sent successfully! Check your inbox.",
      messageId: info.messageId,
      to: email,
      from: FROM_EMAIL,
    });
  } catch (error: any) {
    console.error("[TEST EMAIL] Error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Internal server error",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    }, { status: 500 });
  }
}

