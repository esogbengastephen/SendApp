import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { nanoid } from "nanoid";
import { verifyBankAccount } from "@/lib/moniepoint";
import { generateDedicatedDepositWallet } from "@/lib/offramp-deposit-wallet";
import { getOfframpTransactionsEnabled } from "@/lib/settings";
import { isValidBankAccountNumber, getBankByCode } from "@/lib/nigerian-banks";

/**
 * POST /api/offramp/verify-and-create
 * 1. Verify bank account with Moniepoint (name enquiry)
 * 2. Create off-ramp row with dedicated deposit address
 * 3. Return accountName + depositAddress + transactionId (show wallet immediately)
 * Body: { accountNumber, bankCode, userEmail, network?: "base" }
 */
export async function POST(request: NextRequest) {
  try {
    const offrampEnabled = await getOfframpTransactionsEnabled();
    if (!offrampEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: "Sell (off-ramp) is currently disabled. Please check back later.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      accountNumber,
      bankCode,
      userEmail,
      network = "base",
    } = body as {
      accountNumber?: string;
      bankCode?: string;
      userEmail?: string;
      network?: string;
    };

    if (!accountNumber || !bankCode) {
      return NextResponse.json(
        { success: false, error: "Account number and bank are required." },
        { status: 400 }
      );
    }

    if (!isValidBankAccountNumber(accountNumber)) {
      return NextResponse.json(
        { success: false, error: "Invalid account number. Must be 10 digits." },
        { status: 400 }
      );
    }

    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: "User email is required." },
        { status: 400 }
      );
    }

    // SEND off-ramp uses Base only
    const networkVal = network === "solana" ? "solana" : "base";

    const cleanedAccountNumber = accountNumber.replace(/\D/g, "").slice(0, 10);
    const bankCodeStr = String(bankCode).trim();

    // 1) Verify bank account with Moniepoint only
    const verifyResult = await verifyBankAccount(cleanedAccountNumber, bankCodeStr);

    if (!verifyResult.success || !verifyResult.data?.accountName) {
      const errorMessage =
        (verifyResult.error && verifyResult.error.trim() !== "")
          ? verifyResult.error
          : "Could not verify bank account. Check account number and bank.";
      console.error(
        "[Off-ramp verify-and-create] Moniepoint verification failed:",
        errorMessage,
        "account:",
        cleanedAccountNumber,
        "bankCode:",
        bankCodeStr
      );
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 }
      );
    }

    const accountName = verifyResult.data.accountName;

    // 2) Get user
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", userEmail)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    const userId = userData.id;
    const bank = getBankByCode(String(bankCode).trim());
    const bankName = bank?.name ?? null;

    // 3) Generate dedicated deposit wallet (one address per request)
    const wallet = await generateDedicatedDepositWallet();
    const depositAddress = wallet.address;

    // 4) Unique transaction ID
    let transactionId = nanoid();
    for (let i = 0; i < 10; i++) {
      const { data: existing } = await supabaseAdmin
        .from("offramp_transactions")
        .select("transaction_id")
        .eq("transaction_id", transactionId)
        .maybeSingle();
      if (!existing) break;
      transactionId = nanoid();
    }

    // 5) Insert off-ramp transaction with dedicated deposit address
    const insertPayload = {
      transaction_id: transactionId,
      user_id: userId,
      user_email: userEmail,
      user_account_number: cleanedAccountNumber,
      user_account_name: accountName,
      user_bank_code: String(bankCode).trim(),
      wallet_identifier: String(userId),
      unique_wallet_address: depositAddress,
      wallet_address: depositAddress,
      deposit_address: depositAddress,
      deposit_private_key_encrypted: wallet.privateKeyEncrypted,
      smart_wallet_address: networkVal === "base" ? depositAddress : null,
      solana_wallet_address: networkVal === "solana" ? depositAddress : null,
      account_number: cleanedAccountNumber,
      account_name: accountName,
      bank_code: String(bankCode).trim(),
      bank_name: bankName,
      network: networkVal,
      status: "pending",
    };

    const { error: insertError } = await supabaseAdmin
      .from("offramp_transactions")
      .insert(insertPayload);

    if (insertError) {
      console.error("[Off-ramp verify-and-create] Insert error:", insertError);
      return NextResponse.json(
        {
          success: false,
          error: insertError.code === "23502" ? "Missing required data." : "Failed to create transaction. Try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      accountName,
      depositAddress,
      transactionId,
      network: networkVal,
      message: "Send SEND to this address. Naira will be sent to your account after confirmation.",
    });
  } catch (err: unknown) {
    console.error("[Off-ramp verify-and-create] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Something went wrong.",
      },
      { status: 500 }
    );
  }
}
