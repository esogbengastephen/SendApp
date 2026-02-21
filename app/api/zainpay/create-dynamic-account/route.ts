import { NextRequest, NextResponse } from "next/server";
import { createDynamicVirtualAccount } from "@/lib/zainpay";
import { supabaseAdmin } from "@/lib/supabase";
import { getTransaction, createTransaction, updateTransaction } from "@/lib/transactions";
import { getExchangeRate, getOnrampTransactionsEnabled, getMinimumPurchase } from "@/lib/settings";
import { calculateTransactionFee, calculateFinalTokens, calculateFeeInTokens } from "@/lib/fee-calculation";
import { getSupabaseUserByEmail, getSupabaseUserById, linkWalletToUser } from "@/lib/supabase-users";
import { nanoid } from "nanoid";

/**
 * POST /api/zainpay/create-dynamic-account
 *
 * Creates a ZainPay dynamic virtual account per transaction.
 * Called when user clicks "Pay Now" — returns a bank account number for the user to transfer to.
 */
export async function POST(request: NextRequest) {
  try {
    // Check if onramp is enabled
    const onrampEnabled = await getOnrampTransactionsEnabled();
    if (!onrampEnabled) {
      return NextResponse.json(
        { success: false, error: "Buy transactions are currently disabled. Please check back later." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { transactionId, ngnAmount, walletAddress, userId, userEmail, network, token } = body;

    if (!ngnAmount || !walletAddress) {
      return NextResponse.json(
        { success: false, error: "ngnAmount and walletAddress are required" },
        { status: 400 }
      );
    }

    const amount = parseFloat(ngnAmount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid amount" },
        { status: 400 }
      );
    }

    // Validate minimum purchase
    const minPurchase = await getMinimumPurchase();
    if (amount < minPurchase) {
      return NextResponse.json(
        { success: false, error: `Minimum purchase amount is ₦${minPurchase.toLocaleString()}` },
        { status: 400 }
      );
    }

    // Resolve user
    type CurrentUser = { id: string; email: string; full_name?: string; mobile_number?: string };
    let currentUser: CurrentUser | null = null;
    if (userEmail) {
      const r = await getSupabaseUserByEmail(userEmail);
      if (r.success && r.user) currentUser = r.user as unknown as CurrentUser;
    } else if (userId) {
      const r = await getSupabaseUserById(userId);
      if (r.success && r.user) currentUser = r.user as unknown as CurrentUser;
    }

    // Normalise wallet address
    const normalizedWallet = network === "solana"
      ? walletAddress.trim()
      : walletAddress.trim().toLowerCase();

    // Calculate exchange rate & fees
    const exchangeRate = await getExchangeRate();
    const feeNGN = await calculateTransactionFee(amount);
    const feeInSEND = calculateFeeInTokens(feeNGN, exchangeRate);
    const finalSendAmount = calculateFinalTokens(amount, feeNGN, exchangeRate);

    // Create or update transaction record
    const txId = transactionId || nanoid();
    const existingTx = transactionId ? await getTransaction(transactionId) : null;

    if (existingTx) {
      await updateTransaction(txId, {
        ngnAmount: amount,
        sendAmount: finalSendAmount,
        walletAddress: normalizedWallet,
        exchangeRate,
        userId: currentUser?.id,
        fee_ngn: feeNGN,
        fee_in_send: feeInSEND,
      });
    } else {
      await createTransaction({
        transactionId: txId,
        paystackReference: txId,
        ngnAmount: amount,
        sendAmount: finalSendAmount,
        walletAddress: normalizedWallet,
        exchangeRate,
        userId: currentUser?.id,
        fee_ngn: feeNGN,
        fee_in_send: feeInSEND,
      });
    }

    if (currentUser) {
      await linkWalletToUser(currentUser.id, normalizedWallet);
    }

    // Build user info for ZainPay VA
    const fullName = currentUser?.full_name?.trim() || (userEmail ? userEmail.split("@")[0] : "Customer");
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] || "Customer";
    const surname = nameParts.slice(1).join(" ") || "FlipPay";
    const email = currentUser?.email || userEmail || "customer@flippay.app";
    const mobileNumber = currentUser?.mobile_number || "08000000000";

    console.log(`[ZainPay Dynamic VA] Creating VA for transaction ${txId}, ₦${amount}`);

    // Create dynamic virtual account (no BVN required)
    const vaResult = await createDynamicVirtualAccount({
      firstName,
      surname,
      email,
      mobileNumber,
      amount,
      txnRef: txId,
    });

    if (!vaResult.success || !vaResult.data) {
      console.error("[ZainPay Dynamic VA] Failed to create VA:", vaResult.error, JSON.stringify(vaResult.details));
      return NextResponse.json(
        {
          success: false,
          error: vaResult.error || "Failed to create payment account. Please try again.",
          details: vaResult.details,
        },
        { status: 502 }
      );
    }

    const { accountNumber, bankName, accountName } = vaResult.data;

    console.log(`[ZainPay Dynamic VA] ✅ VA created: ${accountNumber} (${bankName}) for tx ${txId}`);

    // Store virtual account number in transaction metadata so webhook can match deposits
    await supabaseAdmin
      .from("transactions")
      .update({
        metadata: {
          zainpay_account_number: accountNumber,
          zainpay_bank_name: bankName,
          zainpay_expected_amount: amount,
          transaction_id: txId,
          wallet_address: normalizedWallet,
          user_id: currentUser?.id,
          network: network || "send",
          token: token || null,
        },
        status: "pending",
      })
      .eq("transaction_id", txId);

    return NextResponse.json({
      success: true,
      transactionId: txId,
      accountNumber,
      bankName,
      accountName,
      amount,
    });
  } catch (error: any) {
    console.error("[ZainPay Dynamic VA] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
