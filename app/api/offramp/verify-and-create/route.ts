import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { nanoid } from "nanoid";
import { verifyBankAccount } from "@/lib/flutterwave";
import { getOrCreateSmartWallet, encryptWalletPrivateKey } from "@/lib/coinbase-smart-wallet";
import { getOfframpTransactionsEnabled } from "@/lib/settings";
import { isValidBankAccountNumber, getBankByCode } from "@/lib/nigerian-banks";

/**
 * POST /api/offramp/verify-and-create
 * 1. Verify bank account with Flutterwave (name enquiry)
 * 2. Get or create user's Smart Wallet (same as Base receive/generate-address)
 * 3. Create off-ramp row; return accountName + depositAddress + transactionId (show wallet immediately)
 * One pending off-ramp per user. Body: { accountNumber, bankCode, userEmail, network?: "base" }
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
    const bankCodeStr = String(bankCode ?? "").trim();

    // 1) Verify bank account with Flutterwave
    const verifyResult = await verifyBankAccount(cleanedAccountNumber, bankCodeStr);

    if (!verifyResult.success || !verifyResult.data?.accountName) {
      const errorMessage =
        (verifyResult.error && verifyResult.error.trim() !== "")
          ? verifyResult.error
          : "Could not verify bank account. Check account number and bank.";
      console.error(
        "[Off-ramp verify-and-create] Flutterwave verification failed:",
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

    // 3) Enforce one pending off-ramp per user (dedicated wallet is per-user)
    const { data: pendingRow } = await supabaseAdmin
      .from("offramp_transactions")
      .select("transaction_id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle();
    if (pendingRow) {
      return NextResponse.json(
        {
          success: false,
          error: "You already have a pending off-ramp. Complete it or wait for it to be processed before starting another.",
        },
        { status: 400 }
      );
    }

    // 4) Get or create user's Smart Wallet (same as Base / generate-address) — one address for receive and SEND off-ramp
    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("id, email, smart_wallet_address, smart_wallet_owner_encrypted")
      .eq("id", userId)
      .single();

    if (!userRow?.email) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    const walletData = await getOrCreateSmartWallet(
      userRow.id,
      userRow.email,
      userRow.smart_wallet_owner_encrypted ?? undefined,
      userRow.smart_wallet_address ?? undefined
    );

    const depositAddress = walletData.address;

    if (!userRow.smart_wallet_address || !userRow.smart_wallet_owner_encrypted) {
      const encryptedKey = await encryptWalletPrivateKey(walletData.ownerPrivateKey, userRow.id);
      await supabaseAdmin
        .from("users")
        .update({
          smart_wallet_address: walletData.address,
          smart_wallet_owner_encrypted: encryptedKey,
          smart_wallet_salt: walletData.salt,
          smart_wallet_created_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }

    // 5) Unique transaction ID
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

    // 6) Insert off-ramp transaction with user's Smart Wallet as deposit (no EOA key; sweep via owner key)
    // user_* columns: see migration 028. wallet_identifier/unique_wallet_address: NOT NULL in DB.
    const insertPayload = {
      transaction_id: transactionId,
      user_id: userId,
      user_email: userEmail ?? null,
      wallet_address: depositAddress,
      deposit_address: depositAddress,
      deposit_private_key_encrypted: null,
      smart_wallet_address: networkVal === "base" ? depositAddress : null,
      solana_wallet_address: networkVal === "solana" ? depositAddress : null,
      wallet_identifier: depositAddress,
      unique_wallet_address: depositAddress,
      account_number: cleanedAccountNumber,
      account_name: accountName ?? "",
      bank_code: bankCodeStr || null,
      bank_name: bankName ?? null,
      user_account_number: cleanedAccountNumber,
      user_account_name: accountName ?? "",
      user_bank_code: bankCodeStr || null,
      network: networkVal,
      status: "pending",
    };

    if (!depositAddress || depositAddress.length < 10) {
      console.error("[Off-ramp verify-and-create] Invalid deposit address:", depositAddress);
      return NextResponse.json(
        { success: false, error: "Could not get deposit address. Try again." },
        { status: 500 }
      );
    }

    const { error: insertError } = await supabaseAdmin
      .from("offramp_transactions")
      .insert(insertPayload);

    if (insertError) {
      console.error("[Off-ramp verify-and-create] Insert error:", insertError.code, insertError.message, insertError.details);
      const isNotNullViolation = insertError.code === "23502";
      const isUniqueViolation = insertError.code === "23505";
      const hint = insertError.message ? ` (${insertError.message})` : "";
      if (isNotNullViolation) {
        return NextResponse.json(
          { success: false, error: `Missing required data.${hint}` },
          { status: 500 }
        );
      }
      if (isUniqueViolation && insertError.message?.includes("idx_one_pending_tx_per_wallet_account")) {
        const { data: existing } = await supabaseAdmin
          .from("offramp_transactions")
          .select("transaction_id, deposit_address, wallet_address")
          .eq("unique_wallet_address", depositAddress)
          .eq("user_account_number", cleanedAccountNumber)
          .in("status", ["pending", "token_received", "swapping"])
          .maybeSingle();
        const existingDeposit = existing?.deposit_address ?? existing?.wallet_address;
        if (existing?.transaction_id && existingDeposit) {
          return NextResponse.json({
            success: true,
            accountName,
            depositAddress: existingDeposit,
            transactionId: existing.transaction_id,
            network: networkVal,
            message: "You already have a pending off-ramp for this wallet and account. Use the details below to send SEND.",
          });
        }
        return NextResponse.json(
          {
            success: false,
            error: "You already have a pending off-ramp for this wallet and bank account. Complete it or wait for it to be processed before creating another.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: "Failed to create transaction. Try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      accountName,
      depositAddress,
      transactionId,
      network: networkVal,
      message: "Send SEND to your Smart Wallet (same as your receive address). Naira will be sent to your account after confirmation.",
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
