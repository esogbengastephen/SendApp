import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const { email, subject, message, referralCode, referralCount } = await request.json();

    if (!email || !subject || !message) {
      return NextResponse.json(
        { success: false, error: "Email, subject, and message are required" },
        { status: 400 }
      );
    }

    const GMAIL_USER = process.env.GMAIL_USER;
    const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
    const FROM_EMAIL = process.env.GMAIL_FROM_EMAIL || GMAIL_USER;

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      return NextResponse.json({
        success: false,
        error: "Email service not configured",
      }, { status: 500 });
    }

    // Create HTML email with referral info if available
    const referralInfo = referralCode ? `
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #34ff4d;">
        <p style="margin: 0 0 10px; color: #64748b; font-size: 14px; font-weight: 600;">Your Referral Stats:</p>
        <p style="margin: 0; color: #334155; font-size: 14px;">Referral Code: <strong style="color: #34ff4d;">${referralCode}</strong></p>
        ${referralCount !== undefined ? `<p style="margin: 5px 0 0; color: #334155; font-size: 14px;">Total Referrals: <strong>${referralCount}</strong></p>` : ''}
      </div>
    ` : '';

    const htmlEmail = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; padding: 20px;">
            <tr>
              <td align="center" style="padding: 20px 0;">
                <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #34ff4d 0%, #28e645 100%); border-radius: 12px 12px 0 0;">
                      <img src="https://flippay.app/whitelogo.png" alt="FlipPay" style="max-width: 120px; height: auto; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;" />
                      <h1 style="margin: 0; color: #0f172a; font-size: 24px; font-weight: bold;">${subject}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px;">
                      ${referralInfo}
                      <div style="color: #334155; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${message}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 30px 40px; background-color: #f8fafc; border-radius: 0 0 12px 12px; text-align: center; border-top: 1px solid #e2e8f0;">
                      <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.6;">
                        This is an automated message from FlipPay.
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
      from: `"FlipPay" <${FROM_EMAIL}>`,
      to: email,
      subject: subject,
      html: htmlEmail,
    });
    
    return NextResponse.json({ 
      success: true,
      message: "Email sent successfully",
    });
  } catch (error: any) {
    console.error("[Bulk Email] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}

