/**
 * Transaction email utilities
 * Sends emails to users when payments are verified and tokens are distributed
 */

import nodemailer from "nodemailer";
import { generateInvoicePDF } from "./generate-invoice-pdf";

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const FROM_EMAIL = process.env.GMAIL_FROM_EMAIL || GMAIL_USER;

/**
 * Get email transporter
 */
function getEmailTransporter() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error("Gmail SMTP not configured. GMAIL_USER and GMAIL_APP_PASSWORD are required.");
  }

  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });
}

/**
 * Send payment verification email
 */
export async function sendPaymentVerificationEmail(
  email: string,
  ngnAmount: number,
  paystackReference?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!email || !ngnAmount) {
      return { success: false, error: "Email and amount are required" };
    }

    const transporter = getEmailTransporter();

    const htmlEmail = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Verified</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; padding: 20px;">
            <tr>
              <td align="center" style="padding: 20px 0;">
                <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #34ff4d 0%, #28e645 100%); border-radius: 12px 12px 0 0;">
                      <img src="${process.env.NEXT_PUBLIC_APP_URL || 'https://flippay.app'}/whitelogo.png" alt="FlipPay" style="max-width: 120px; height: auto; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;" />
                      <h1 style="margin: 0; color: #0f172a; font-size: 28px; font-weight: bold;">Payment Verified ✅</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px;">
                      <p style="margin: 0 0 20px; color: #334155; font-size: 16px; line-height: 1.6;">
                        Hello,
                      </p>
                      <p style="margin: 0 0 20px; color: #334155; font-size: 16px; line-height: 1.6;">
                        Your payment has been successfully verified!
                      </p>
                      <div style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); padding: 20px; border-radius: 12px; margin: 20px 0;">
                        <p style="margin: 0 0 10px; color: #64748b; font-size: 14px; font-weight: 600;">Amount Paid</p>
                        <p style="margin: 0; font-size: 24px; font-weight: bold; color: #34ff4d;">₦${parseFloat(ngnAmount.toString()).toLocaleString()}</p>
                      </div>
                      ${paystackReference ? `<p style="margin: 20px 0 0; color: #64748b; font-size: 12px;">Reference: ${paystackReference}</p>` : ''}
                      <p style="margin: 30px 0 0; color: #334155; font-size: 16px; line-height: 1.6;">
                        Your tokens are being processed and will be sent to your wallet shortly. You'll receive another email once the tokens have been distributed.
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

    await transporter.sendMail({
      from: `"FlipPay" <${FROM_EMAIL}>`,
      to: email,
      subject: "Payment Verified - FlipPay",
      html: htmlEmail,
    });

    console.log(`[Payment Email] ✅ Payment verification email sent to ${email}`);
    
    return { success: true };
  } catch (error: any) {
    console.error("[Payment Email] Error:", error);
    return { success: false, error: error.message || "Failed to send email" };
  }
}

/**
 * Send token distribution email
 */
export async function sendTokenDistributionEmail(
  email: string,
  ngnAmount: number,
  sendAmount: string,
  walletAddress: string,
  txHash?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!email || !ngnAmount || !sendAmount || !walletAddress) {
      return { success: false, error: "Missing required fields" };
    }

    const transporter = getEmailTransporter();

    const explorerUrl = txHash ? `https://basescan.org/tx/${txHash}` : null;

    const htmlEmail = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Tokens Distributed</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; padding: 20px;">
            <tr>
              <td align="center" style="padding: 20px 0;">
                <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #34ff4d 0%, #28e645 100%); border-radius: 12px 12px 0 0;">
                      <img src="${process.env.NEXT_PUBLIC_APP_URL || 'https://flippay.app'}/whitelogo.png" alt="FlipPay" style="max-width: 120px; height: auto; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;" />
                      <h1 style="margin: 0; color: #0f172a; font-size: 28px; font-weight: bold;">Tokens Distributed! 🎉</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px;">
                      <p style="margin: 0 0 20px; color: #334155; font-size: 16px; line-height: 1.6;">
                        Hello,
                      </p>
                      <p style="margin: 0 0 20px; color: #334155; font-size: 16px; line-height: 1.6;">
                        Your tokens have been successfully distributed to your wallet!
                      </p>
                      
                      <div style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); padding: 20px; border-radius: 12px; margin: 20px 0;">
                        <p style="margin: 0 0 10px; color: #64748b; font-size: 14px; font-weight: 600;">Amount Paid</p>
                        <p style="margin: 0 0 20px; font-size: 24px; font-weight: bold; color: #34ff4d;">₦${parseFloat(ngnAmount.toString()).toLocaleString()}</p>
                        
                        <p style="margin: 20px 0 10px; color: #64748b; font-size: 14px; font-weight: 600;">Tokens Received</p>
                        <p style="margin: 0 0 20px; font-size: 24px; font-weight: bold; color: #34ff4d;">${parseFloat(sendAmount).toLocaleString()} SEND</p>
                        
                        <p style="margin: 20px 0 10px; color: #64748b; font-size: 14px; font-weight: 600;">Wallet Address</p>
                        <p style="margin: 0; font-size: 14px; color: #334155; word-break: break-all; font-family: 'Courier New', monospace;">${walletAddress}</p>
                      </div>
                      
                      ${txHash ? `
                        <div style="text-align: center; margin: 30px 0;">
                          <a href="${explorerUrl}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #34ff4d 0%, #28e645 100%); color: #0f172a; text-decoration: none; border-radius: 8px; font-weight: bold;">
                            View Transaction on Basescan
                          </a>
                        </div>
                        <p style="margin: 20px 0 0; color: #64748b; font-size: 12px; text-align: center; word-break: break-all;">TX Hash: ${txHash}</p>
                      ` : ''}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"FlipPay" <${FROM_EMAIL}>`,
      to: email,
      subject: "Tokens Distributed - FlipPay",
      html: htmlEmail,
    });

    console.log(`[Token Email] ✅ Token distribution email sent to ${email}`);
    
    return { success: true };
  } catch (error: any) {
    console.error("[Token Email] Error:", error);
    return { success: false, error: error.message || "Failed to send email" };
  }
}

/**
 * Send invoice email to customer
 */
export async function sendInvoiceEmail(
  customerEmail: string,
  invoiceNumber: string,
  invoiceUrl: string,
  amount: number,
  currency: string,
  merchantName: string,
  description?: string | null,
  dueDate?: string | null,
  cryptoAddress?: string | null,
  cryptoChainId?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!customerEmail || !invoiceNumber || !invoiceUrl) {
      return { success: false, error: "Email, invoice number, and URL are required" };
    }

    // Only send if email is configured
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      console.log(`[Invoice Email] Email service not configured. Would send invoice ${invoiceNumber} to ${customerEmail}`);
      return { success: false, error: "Email service not configured" };
    }

    const transporter = getEmailTransporter();

    const amountDisplay = currency === "NGN" 
      ? `₦${parseFloat(amount.toString()).toLocaleString()}`
      : `${parseFloat(amount.toString()).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${currency}`;

    const htmlEmail = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Invoice - ${invoiceNumber}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; padding: 20px;">
            <tr>
              <td align="center" style="padding: 20px 0;">
                <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #34ff4d 0%, #28e645 100%); border-radius: 12px 12px 0 0;">
                      <img src="${process.env.NEXT_PUBLIC_APP_URL || 'https://flippay.app'}/whitelogo.png" alt="FlipPay" style="max-width: 120px; height: auto; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;" />
                      <h1 style="margin: 0; color: #0f172a; font-size: 28px; font-weight: bold;">New Invoice</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px;">
                      <p style="margin: 0 0 20px; color: #334155; font-size: 16px; line-height: 1.6;">
                        Hello,
                      </p>
                      <p style="margin: 0 0 20px; color: #334155; font-size: 16px; line-height: 1.6;">
                        You have received a new invoice from <strong>${merchantName}</strong>.
                      </p>
                      
                      <div style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); padding: 20px; border-radius: 12px; margin: 20px 0;">
                        <p style="margin: 0 0 10px; color: #64748b; font-size: 14px; font-weight: 600;">Invoice Number</p>
                        <p style="margin: 0 0 20px; font-size: 18px; font-weight: bold; color: #0f172a;">${invoiceNumber}</p>
                        
                        <p style="margin: 20px 0 10px; color: #64748b; font-size: 14px; font-weight: 600;">Amount Due</p>
                        <p style="margin: 0 0 20px; font-size: 24px; font-weight: bold; color: #34ff4d;">${amountDisplay}</p>
                        
                        ${description ? `<p style="margin: 20px 0 10px; color: #64748b; font-size: 14px; font-weight: 600;">Description</p><p style="margin: 0 0 20px; color: #334155; font-size: 14px;">${description}</p>` : ''}
                        
                        ${dueDate ? `<p style="margin: 20px 0 10px; color: #64748b; font-size: 14px; font-weight: 600;">Due Date</p><p style="margin: 0 0 20px; color: #334155; font-size: 14px;">${new Date(dueDate).toLocaleDateString()}</p>` : ''}
                        
                        ${cryptoAddress && cryptoChainId ? `
                          <p style="margin: 20px 0 10px; color: #64748b; font-size: 14px; font-weight: 600;">Payment Wallet Address</p>
                          <p style="margin: 0 0 10px; font-size: 12px; color: #334155; word-break: break-all; font-family: 'Courier New', monospace; background: #f1f5f9; padding: 10px; border-radius: 6px;">${cryptoAddress}</p>
                          <p style="margin: 0 0 20px; color: #64748b; font-size: 12px;">Network: ${cryptoChainId}</p>
                        ` : ''}
                      </div>
                      
                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${invoiceUrl}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #34ff4d 0%, #28e645 100%); color: #0f172a; text-decoration: none; border-radius: 8px; font-weight: bold; margin-bottom: 15px;">
                          View & Pay Invoice
                        </a>
                        <p style="margin: 15px 0 0; color: #64748b; font-size: 14px; text-align: center;">
                          📎 A PDF copy of this invoice is attached to this email
                        </p>
                      </div>
                      
                      <p style="margin: 20px 0 0; color: #64748b; font-size: 12px; text-align: center; word-break: break-all;">
                        Or copy this link: <a href="${invoiceUrl}" style="color: #34ff4d; text-decoration: underline;">${invoiceUrl}</a>
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

    // Generate PDF attachment
    let attachments: any[] = [];
    try {
      const pdfBuffer = await generateInvoicePDF(invoiceUrl);
      if (pdfBuffer) {
        attachments.push({
          filename: `Invoice-${invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        });
        console.log(`[Invoice Email] PDF generated and attached for invoice ${invoiceNumber}`);
      } else {
        console.log(`[Invoice Email] PDF generation failed for invoice ${invoiceNumber}, sending email without attachment`);
      }
    } catch (pdfError: any) {
      console.error(`[Invoice Email] Error generating PDF:`, pdfError);
      // Continue without PDF attachment
    }

    await transporter.sendMail({
      from: `"FlipPay" <${FROM_EMAIL}>`,
      to: customerEmail,
      subject: `Invoice ${invoiceNumber} from ${merchantName} - FlipPay`,
      html: htmlEmail,
      attachments: attachments,
    });

    console.log(`[Invoice Email] ✅ Invoice email sent to ${customerEmail} for invoice ${invoiceNumber}`);
    
    return { success: true };
  } catch (error: any) {
    console.error("[Invoice Email] Error:", error);
    return { success: false, error: error.message || "Failed to send email" };
  }
}

