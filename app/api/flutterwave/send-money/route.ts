import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { createTransfer, normalizeMobileNumber, isValidNigerianMobile } from "@/lib/flutterwave";
import { getUserFromStorage } from "@/lib/session";

/**
 * Send money using phone number
 * User enters recipient's phone number, we look up their Flutterwave account and transfer
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipientPhoneNumber, amount, narration } = body;

    // Get current user from session
    const user = getUserFromStorage();
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!recipientPhoneNumber || !amount) {
      return NextResponse.json(
        { success: false, error: "Recipient phone number and amount are required" },
        { status: 400 }
      );
    }

    // Validate phone number
    if (!isValidNigerianMobile(recipientPhoneNumber)) {
      const cleaned = recipientPhoneNumber.replace(/\D/g, "");
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid Nigerian mobile number format. Received: "${recipientPhoneNumber}" (${cleaned.length} digits). Expected format: 07034494055, 7034494055, or +2347034494055`,
          received: recipientPhoneNumber,
          cleanedLength: cleaned.length,
        },
        { status: 400 }
      );
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid amount" },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = normalizeMobileNumber(recipientPhoneNumber);

    // Look up recipient's Flutterwave virtual account
    const { data: recipient, error: lookupError } = await supabaseAdmin
      .from("users")
      .select("id, email, flutterwave_virtual_account_number, flutterwave_virtual_account_bank, mobile_number")
      .eq("mobile_number", normalizedPhone)
      .maybeSingle();

    if (lookupError) {
      console.error("[Flutterwave Send] Lookup error:", lookupError);
      return NextResponse.json(
        { success: false, error: "Failed to look up recipient account" },
        { status: 500 }
      );
    }

    if (!recipient || !recipient.flutterwave_virtual_account_number) {
      return NextResponse.json(
        { success: false, error: "Recipient account not found. Please ensure they have registered with this phone number." },
        { status: 404 }
      );
    }

    // Prevent sending to yourself
    if (recipient.id === user.id) {
      return NextResponse.json(
        { success: false, error: "Cannot send money to yourself" },
        { status: 400 }
      );
    }

    // Get sender's Flutterwave account info
    const { data: sender } = await supabaseAdmin
      .from("users")
      .select("flutterwave_virtual_account_number, flutterwave_customer_id, flutterwave_balance")
      .eq("id", user.id)
      .single();

    if (!sender || !sender.flutterwave_virtual_account_number) {
      return NextResponse.json(
        { success: false, error: "Your Flutterwave account is not set up. Please contact support." },
        { status: 400 }
      );
    }

    // Check sender's balance
    const senderBalance = parseFloat(sender.flutterwave_balance?.toString() || "0");
    if (senderBalance < amountNum) {
      return NextResponse.json(
        { success: false, error: `Insufficient balance. Your balance is ₦${senderBalance.toLocaleString()}` },
        { status: 400 }
      );
    }

    // Create Flutterwave transfer
    // For wallet-to-wallet transfers, we need to use the virtual account number
    // Flutterwave will handle the transfer between virtual accounts
    console.log(`[Flutterwave Send] Transferring ₦${amountNum} from ${sender.flutterwave_virtual_account_number} to ${recipient.flutterwave_virtual_account_number}`);

    const transferResult = await createTransfer({
      accountBank: recipient.flutterwave_virtual_account_bank || "flutterwave",
      accountNumber: recipient.flutterwave_virtual_account_number,
      amount: amountNum,
      currency: "NGN",
      narration: narration || `Transfer to ${normalizedPhone}`,
      reference: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    });

    if (!transferResult.success) {
      console.error("[Flutterwave Send] Transfer failed:", transferResult.error);
      return NextResponse.json(
        { success: false, error: transferResult.error || "Transfer failed" },
        { status: 500 }
      );
    }

    // Update sender's balance in database
    const newSenderBalance = senderBalance - amountNum;
    await supabaseAdmin
      .from("users")
      .update({
        flutterwave_balance: newSenderBalance,
        flutterwave_balance_updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    // Update recipient's balance in database (will be confirmed by webhook)
    const { data: currentRecipient } = await supabaseAdmin
      .from("users")
      .select("flutterwave_balance")
      .eq("id", recipient.id)
      .single();

    const recipientBalance = parseFloat(currentRecipient?.flutterwave_balance?.toString() || "0");
    await supabaseAdmin
      .from("users")
      .update({
        flutterwave_balance: recipientBalance + amountNum,
        flutterwave_balance_updated_at: new Date().toISOString(),
      })
      .eq("id", recipient.id);

    console.log(`[Flutterwave Send] ✅ Transfer successful:`, transferResult.data);

    return NextResponse.json({
      success: true,
      message: "Transfer initiated successfully",
      data: {
        transferId: transferResult.data?.id,
        reference: transferResult.data?.reference,
        amount: amountNum,
        recipientPhoneNumber: normalizedPhone,
        newBalance: newSenderBalance,
      },
    });
  } catch (error: any) {
    console.error("[Flutterwave Send] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
