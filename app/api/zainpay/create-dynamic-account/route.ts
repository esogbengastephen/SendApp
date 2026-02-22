import { NextRequest, NextResponse } from "next/server";
import { createDynamicVirtualAccount } from "@/lib/zainpay";
import { supabaseAdmin } from "@/lib/supabase";
import { getTransaction, createTransaction, updateTransaction } from "@/lib/transactions";
import { getExchangeRate, getOnrampTransactionsEnabled, getMinimumPurchase } from "@/lib/settings";
import { calculateTransactionFee, calculateFinalTokens, calculateFeeInTokens } from "@/lib/fee-calculation";
import { getSupabaseUserByEmail, getSupabaseUserById, linkWalletToUser } from "@/lib/supabase-users";
import { customAlphabet } from "nanoid";

// Clean alphanumeric ID — ZainPay txnRef must not contain hyphens or underscores
const alphanumericId = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 21);

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

    // Always generate a fresh clean alphanumeric transaction ID for each Pay Now click.
    // Never reuse an old transaction — this prevents txnRef mismatches with ZainPay.
    // If the frontend passes a completed transaction ID, we ignore it and create a new one.
    let txId: string;
    if (transactionId) {
      const existingTx = await getTransaction(transactionId);
      if (existingTx && existingTx.status === "completed") {
        // Previous transaction is done — create a fresh one
        txId = alphanumericId();
      } else if (existingTx) {
        // Existing pending transaction — reuse its ID (already clean or clean it)
        txId = transactionId.replace(/[^a-zA-Z0-9]/g, "");
        if (txId !== transactionId) {
          // ID had special chars — create new record with clean ID
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
        } else {
          await updateTransaction(txId, {
            ngnAmount: amount,
            sendAmount: finalSendAmount,
            walletAddress: normalizedWallet,
            exchangeRate,
            userId: currentUser?.id,
            fee_ngn: feeNGN,
            fee_in_send: feeInSEND,
          });
        }
      } else {
        // No existing record — clean the ID and create fresh
        txId = transactionId.replace(/[^a-zA-Z0-9]/g, "") || alphanumericId();
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
    } else {
      // No ID passed — generate a fresh clean one
      txId = alphanumericId();
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

    const email = currentUser?.email || userEmail || "customer@flippay.app";

    console.log(`[ZainPay Dynamic VA] Creating VA for transaction ${txId}, ₦${amount}`);

    // Create dynamic virtual account — only needs email, amount, txnRef
    const vaResult = await createDynamicVirtualAccount({
      email,
      amount,
      txnRef: txId,
      duration: 2880, // max allowed by ZainPay (48 minutes)
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
