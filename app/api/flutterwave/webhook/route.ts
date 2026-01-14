import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyWebhookSignature } from "@/lib/flutterwave";

/**
 * Flutterwave webhook handler
 * Processes incoming payments to virtual accounts
 * Updates user balance and creates transaction records
 */
export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get("verif-hash");

    if (!signature) {
      console.error("[Flutterwave Webhook] Missing signature");
      return NextResponse.json(
        { success: false, error: "Missing signature" },
        { status: 401 }
      );
    }

    // Verify webhook signature
    const isValid = verifyWebhookSignature(body, signature);
    if (!isValid) {
      console.error("[Flutterwave Webhook] Invalid signature");
      return NextResponse.json(
        { success: false, error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse the webhook payload
    const event = JSON.parse(body);

    console.log(`[Flutterwave Webhook] Event received:`, event.event);

    // Handle virtual account payment
    if (event.event === "virtualaccountpayment") {
      const paymentData = event.data;
      const accountNumber = paymentData.account_number;
      const amount = parseFloat(paymentData.amount);
      const txRef = paymentData.tx_ref;
      const flwRef = paymentData.flw_ref;

      console.log(`[Flutterwave Webhook] Payment received: ₦${amount} to account ${accountNumber}`);

      if (!accountNumber) {
        console.error(`[Flutterwave Webhook] No account number in payment`);
        return NextResponse.json(
          { success: false, error: "Missing account number" },
          { status: 400 }
        );
      }

      // Find user by Flutterwave virtual account number
      const { data: user, error: userError } = await supabaseAdmin
        .from("users")
        .select("id, email, flutterwave_balance, mobile_number")
        .eq("flutterwave_virtual_account_number", accountNumber)
        .maybeSingle();

      if (userError) {
        console.error("[Flutterwave Webhook] Error finding user:", userError);
        return NextResponse.json(
          { success: false, error: "Database error" },
          { status: 500 }
        );
      }

      if (!user) {
        console.error(`[Flutterwave Webhook] User not found for account ${accountNumber}`);
        return NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 }
        );
      }

      // Update user's balance
      const currentBalance = parseFloat(user.flutterwave_balance?.toString() || "0");
      const newBalance = currentBalance + amount;

      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          flutterwave_balance: newBalance,
          flutterwave_balance_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("[Flutterwave Webhook] Error updating balance:", updateError);
        return NextResponse.json(
          { success: false, error: "Failed to update balance" },
          { status: 500 }
        );
      }

      console.log(`[Flutterwave Webhook] ✅ Balance updated for user ${user.id}: ₦${currentBalance} → ₦${newBalance}`);

      // TODO: Create transaction record if needed
      // TODO: Send notification email to user

      return NextResponse.json({
        success: true,
        message: "Payment processed successfully",
        data: {
          userId: user.id,
          accountNumber,
          amount,
          newBalance,
        },
      });
    }

    // Handle other events (transfer completed, etc.)
    console.log(`[Flutterwave Webhook] Unhandled event: ${event.event}`);
    return NextResponse.json({
      success: true,
      message: "Event received but not processed",
    });
  } catch (error: any) {
    console.error("[Flutterwave Webhook] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
