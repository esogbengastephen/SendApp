import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { success: false, error: "Email and code are required" },
        { status: 400 }
      );
    }

    // Gmail SMTP Configuration
    const GMAIL_USER = process.env.GMAIL_USER;
    const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
    const FROM_EMAIL = process.env.GMAIL_FROM_EMAIL || GMAIL_USER;

    console.log(`[EMAIL] Attempting to send email to: ${email}`);
    console.log(`[EMAIL] GMAIL_USER configured: ${GMAIL_USER ? 'Yes (' + GMAIL_USER + ')' : 'No'}`);
    console.log(`[EMAIL] GMAIL_APP_PASSWORD configured: ${GMAIL_APP_PASSWORD ? 'Yes' : 'No'}`);
    console.log(`[EMAIL] FROM_EMAIL: ${FROM_EMAIL}`);

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      console.error("[EMAIL] ❌ Gmail SMTP not configured");
      console.log(`[EMAIL] 📧 Confirmation code for ${email}: ${code}`);
      console.log(`[EMAIL] Add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local`);
      return NextResponse.json({ 
        success: false,
        error: "Email service not configured. GMAIL_USER and GMAIL_APP_PASSWORD are required.",
        message: "Email service not configured. Code logged to console.",
        code: process.env.NODE_ENV === "development" ? code : undefined,
      });
    }

    // Create beautiful HTML email template matching your design
    const htmlEmail = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Confirmation Code</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
          <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; padding: 20px;">
            <tr>
              <td align="center" style="padding: 20px 0;">
                <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #34ff4d 0%, #28e645 100%); border-radius: 12px 12px 0 0;">
                      <h1 style="margin: 0; color: #0f172a; font-size: 28px; font-weight: bold;">Your Confirmation Code</h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <p style="margin: 0 0 20px; color: #334155; font-size: 16px; line-height: 1.6;">
                        Hello,
                      </p>
                      <p style="margin: 0 0 30px; color: #334155; font-size: 16px; line-height: 1.6;">
                        Use the code below to complete your signup or login:
                      </p>
                      
                      <!-- Code Display with Star Border Effect -->
                      <div style="position: relative; display: inline-block; width: 100%; max-width: 100%; margin: 30px 0;">
                        <div style="position: relative; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); padding: 30px; border-radius: 20px; text-align: center; border: 1px solid rgba(52, 255, 77, 0.4); box-shadow: 0 0 20px rgba(52, 255, 77, 0.3), 0 0 40px rgba(52, 255, 77, 0.15), 0 0 60px rgba(52, 255, 77, 0.08), inset 0 0 20px rgba(52, 255, 77, 0.08);">
                          <div style="font-size: 42px; font-weight: bold; color: #34ff4d; letter-spacing: 8px; font-family: 'Courier New', monospace; margin: 0; text-shadow: 0 0 10px rgba(52, 255, 77, 0.6), 0 0 20px rgba(52, 255, 77, 0.3);">
                            ${code}
                          </div>
                        </div>
                      </div>
                      
                      <p style="margin: 20px 0 0; color: #64748b; font-size: 14px; text-align: center; line-height: 1.6;">
                        This code will expire in <strong>10 minutes</strong>.
                      </p>
                      <p style="margin: 10px 0 0; color: #64748b; font-size: 14px; text-align: center; line-height: 1.6;">
                        If you didn't request this code, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; background-color: #f8fafc; border-radius: 0 0 12px 12px; text-align: center; border-top: 1px solid #e2e8f0;">
                      <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.6;">
                        This is an automated message. Please do not reply to this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    // Create Gmail SMTP transporter
    console.log(`[EMAIL] Creating Gmail SMTP transporter...`);
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD, // Gmail App Password (not regular password)
      },
    });

    // Verify transporter configuration
    try {
      await transporter.verify();
      console.log(`[EMAIL] ✅ SMTP server is ready to send emails`);
    } catch (verifyError: any) {
      console.error("[EMAIL] ❌ SMTP verification failed:", verifyError);
      return NextResponse.json({
        success: false,
        error: `SMTP configuration error: ${verifyError.message}`,
        details: "Please check your GMAIL_USER and GMAIL_APP_PASSWORD in .env.local",
      }, { status: 500 });
    }

    // Send email via Gmail SMTP
    console.log(`[EMAIL] Sending email via Gmail SMTP...`);
    const mailOptions = {
      from: `"FlipPay" <${FROM_EMAIL}>`,
      to: email,
      subject: "Your Confirmation Code - FlipPay",
      html: htmlEmail,
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`[EMAIL] ✅ Confirmation code sent successfully to ${email}`);
    console.log(`[EMAIL] Message ID: ${info.messageId}`);
    console.log(`[EMAIL] Response: ${info.response}`);
    
    return NextResponse.json({ 
      success: true,
      message: "Email sent successfully",
      messageId: info.messageId,
    });
  } catch (error: any) {
    console.error("[EMAIL] Error sending email:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Failed to send email",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

