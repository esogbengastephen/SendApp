import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { createTransfer, normalizeMobileNumber, isValidNigerianMobile } from "@/lib/flutterwave";
import { getUserFromStorage } from "@/lib/session";
import { nanoid } from "nanoid";
import { getTransferBankCode } from "@/lib/nigerian-banks";

/**
 * Send money - supports both:
 * 1. Sending to other users (by phone number)
 * 2. Sending to bank accounts (by account number + bank code)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      recipientType = "user", // "user" or "bank"
      recipientPhoneNumber, 
      recipientAccountNumber,
      recipientBankCode,
      amount, 
      narration 
    } = body;

    // Get current user from session
    const user = getUserFromStorage();
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!amount) {
      return NextResponse.json(
        { success: false, error: "Amount is required" },
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

    // Get sender's Flutterwave account info
    const { data: sender } = await supabaseAdmin
      .from("users")
      .select("flutterwave_virtual_account_number, flutterwave_customer_id, flutterwave_balance, email")
      .eq("id", user.id)
      .single();

    if (!sender || !sender.flutterwave_virtual_account_number) {
      return NextResponse.json(
        { success: false, error: "Your NGN account is not set up. Please contact support." },
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

    let accountBank: string;
    let accountNumber: string;
    let recipientInfo: any = null;
    let recipient: any = null; // Declare recipient outside the if block

    if (recipientType === "user") {
      // Send to user - validate and lookup by phone number
      if (!recipientPhoneNumber) {
        return NextResponse.json(
          { success: false, error: "Recipient phone number is required" },
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

      // Convert bank name to bank code for Flutterwave transfer
      const bankName = recipient.flutterwave_virtual_account_bank || "flutterwave";
      accountBank = getTransferBankCode(bankName);
      accountNumber = recipient.flutterwave_virtual_account_number;
      recipientInfo = {
        type: "user",
        phone: normalizedPhone,
        userId: recipient.id,
      };

      console.log(`[Flutterwave Send] Transferring ₦${amountNum} from ${sender.flutterwave_virtual_account_number} to user ${normalizedPhone} (${accountNumber})`);
    } else {
      // Send to bank account
      if (!recipientAccountNumber || !recipientBankCode) {
        return NextResponse.json(
          { success: false, error: "Recipient account number and bank code are required" },
          { status: 400 }
        );
      }

      // Validate account number (10 digits)
      const cleanedAccount = recipientAccountNumber.replace(/\D/g, "");
      if (cleanedAccount.length !== 10) {
        return NextResponse.json(
          { success: false, error: "Invalid account number. Must be 10 digits." },
          { status: 400 }
        );
      }

      accountBank = recipientBankCode;
      accountNumber = cleanedAccount;
      recipientInfo = {
        type: "bank",
        accountNumber: cleanedAccount,
        bankCode: recipientBankCode,
      };

      console.log(`[Flutterwave Send] Transferring ₦${amountNum} from ${sender.flutterwave_virtual_account_number} to bank account ${cleanedAccount} (Bank: ${recipientBankCode})`);
    }

    // Generate transfer reference
    const transferReference = `TX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const transferResult = await createTransfer({
      accountBank,
      accountNumber,
      amount: amountNum,
      currency: "NGN",
      narration: narration || (recipientType === "user" 
        ? `Transfer to ${recipientInfo.phone}` 
        : `Transfer to ${accountNumber}`),
      reference: transferReference,
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

    // Update recipient's balance in database (only for user-to-user transfers)
    // Bank transfers don't have a recipient user in our system
    if (recipientType === "user" && recipientInfo.userId) {
      const { data: currentRecipient } = await supabaseAdmin
        .from("users")
        .select("flutterwave_balance")
        .eq("id", recipientInfo.userId)
        .single();

      const recipientBalance = parseFloat(currentRecipient?.flutterwave_balance?.toString() || "0");
      await supabaseAdmin
        .from("users")
        .update({
          flutterwave_balance: recipientBalance + amountNum,
          flutterwave_balance_updated_at: new Date().toISOString(),
        })
        .eq("id", recipientInfo.userId);
    }

    // Create transaction record for the transfer (pending status)
    const transactionId = `TRANSFER-${Date.now()}-${nanoid(8)}`;
    const walletAddress = recipientType === "user" && recipient?.flutterwave_virtual_account_number
      ? `ngn_transfer_${recipient.flutterwave_virtual_account_number}`
      : `ngn_transfer_${accountNumber}`;
    const { error: txError } = await supabaseAdmin
      .from("transactions")
      .insert({
        transaction_id: transactionId,
        user_id: user.id,
        wallet_address: walletAddress,
        ngn_amount: amountNum,
        send_amount: "0",
        status: "pending", // Will be updated by webhook when transfer completes/fails
        paystack_reference: transferResult.data?.reference || transferReference,
        exchange_rate: null,
        initialized_at: new Date().toISOString(),
        metadata: {
          type: "ngn_transfer",
          recipient_type: recipientType,
          sender_account: sender.flutterwave_virtual_account_number,
          recipient_account: accountNumber,
          recipient_bank: accountBank,
          ...(recipientType === "user" 
            ? {
                recipient_phone: recipientInfo.phone,
                recipient_id: recipientInfo.userId,
              }
            : {
                recipient_account_number: recipientInfo.accountNumber,
                recipient_bank_code: recipientInfo.bankCode,
              }),
          reference: transferReference,
          transfer_id: transferResult.data?.id,
          source: "flutterwave_send_money",
        },
      });

    if (txError) {
      console.error("[Flutterwave Send] Error creating transaction record:", txError);
      // Don't fail the transfer if transaction record creation fails
    } else {
      console.log(`[Flutterwave Send] ✅ Transaction record created: ${transactionId}`);
    }

    console.log(`[Flutterwave Send] ✅ Transfer successful:`, transferResult.data);

    return NextResponse.json({
      success: true,
      message: "Transfer initiated successfully",
      data: {
        transferId: transferResult.data?.id,
        reference: transferResult.data?.reference,
        amount: amountNum,
        recipientType,
        ...(recipientType === "user" 
          ? { recipientPhoneNumber: recipientInfo.phone }
          : { 
              recipientAccountNumber: recipientInfo.accountNumber,
              recipientBankCode: recipientInfo.bankCode,
            }),
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
