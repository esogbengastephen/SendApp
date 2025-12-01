import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const { email, referralCode } = await request.json();

    if (!email || !referralCode) {
      return NextResponse.json(
        { success: false, error: "Email and referral code are required" },
        { status: 400 }
      );
    }

    const GMAIL_USER = process.env.GMAIL_USER;
    const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
    const FROM_EMAIL = process.env.GMAIL_FROM_EMAIL || GMAIL_USER;

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      console.error("[Referral Email] Gmail SMTP not configured");
      return NextResponse.json({
        success: false,
        error: "Email service not configured",
      }, { status: 500 });
    }

    const htmlEmail = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Referral Code</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
          <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; padding: 20px;">
            <tr>
              <td align="center" style="padding: 20px 0;">
                <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #34ff4d 0%, #28e645 100%); border-radius: 12px 12px 0 0;">
                      <h1 style="margin: 0; color: #0f172a; font-size: 28px; font-weight: bold;">Welcome! Your Referral Code</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px;">
                      <p style="margin: 0 0 20px; color: #334155; font-size: 16px; line-height: 1.6;">
                        Congratulations! Your account has been created successfully.
                      </p>
                      <p style="margin: 0 0 30px; color: #334155; font-size: 16px; line-height: 1.6;">
                        Share your unique referral code with friends and earn rewards:
                      </p>
                      
                      <!-- Referral Code Display with Star Border Effect -->
                      <div style="position: relative; display: inline-block; width: 100%; max-width: 100%; margin: 30px 0;">
                        <div style="position: relative; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); padding: 30px; border-radius: 20px; text-align: center; border: 1px solid rgba(52, 255, 77, 0.4); box-shadow: 0 0 20px rgba(52, 255, 77, 0.3), 0 0 40px rgba(52, 255, 77, 0.15), 0 0 60px rgba(52, 255, 77, 0.08), inset 0 0 20px rgba(52, 255, 77, 0.08);">
                          <p style="margin: 0 0 10px; color: #64748b; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Your Referral Code</p>
                          <div style="font-size: 36px; font-weight: bold; color: #34ff4d; letter-spacing: 4px; font-family: 'Courier New', monospace; margin: 0; text-shadow: 0 0 10px rgba(52, 255, 77, 0.6), 0 0 20px rgba(52, 255, 77, 0.3);">
                            ${referralCode}
                          </div>
                        </div>
                      </div>
                      
                      <p style="margin: 20px 0 0; color: #64748b; font-size: 14px; text-align: center; line-height: 1.6;">
                        Share this code with friends when they sign up to earn rewards!
                      </p>
                    </td>
                  </tr>
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

    await transporter.sendMail({
      from: `"SendAfrica" <${FROM_EMAIL}>`,
      to: email,
      subject: "Your Referral Code - SendAfrica",
      html: htmlEmail,
    });
    
    console.log(`[Referral Email] ✅ Referral code email sent successfully to ${email}`);
    
    return NextResponse.json({ 
      success: true,
      message: "Referral code email sent successfully",
    });
  } catch (error: any) {
    console.error("[Referral Email] Error sending email:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}

