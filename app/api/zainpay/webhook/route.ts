import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTransaction, updateTransaction } from "@/lib/transactions";
import { distributeTokens } from "@/lib/token-distribution";
import { getExchangeRate } from "@/lib/settings";
import { calculateTransactionFee, calculateFinalTokens, calculateFeeInTokens } from "@/lib/fee-calculation";
import { recordRevenue } from "@/lib/revenue";
import { sendPaymentVerificationEmail, sendTokenDistributionEmail } from "@/lib/transaction-emails";
import { updateReferralCountOnTransaction } from "@/lib/supabase";

/**
 * GET /api/zainpay/webhook
 * Health check for the webhook endpoint.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "ZainPay webhook endpoint is active",
    endpoint: "/api/zainpay/webhook",
    events: ["virtualAccountDeposit", "deposit"],
  });
}

/**
 * POST /api/zainpay/webhook
 *
 * Handles ZainPay deposit notifications.
 * Called when a user transfers money to a dynamic virtual account.
 *
 * ZainPay deposit payload shape:
 * {
 *   "event": "virtualAccountDeposit",
 *   "data": {
 *     "accountNumber": "7966XXXXXX",
 *     "amount": 500000,        ← in kobo
 *     "txnRef": "...",
 *     "txnType": "deposit",
 *     "status": "success",
 *     "senderName": "...",
 *     "narration": "..."
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  let bodyText = "";
  try {
    bodyText = await request.text();
    const body = JSON.parse(bodyText);

    console.log("[ZainPay Webhook] Received:", JSON.stringify(body, null, 2));

    const event = body?.event ?? body?.type ?? "";
    const data = body?.data ?? body;

    const txnType = String(data?.txnType ?? "").toLowerCase();
    const status = String(data?.status ?? "").toLowerCase();
    const isDeposit =
      event === "virtualAccountDeposit" ||
      event === "virtual_account_deposit" ||
      txnType === "deposit";

    if (!isDeposit) {
      console.log(`[ZainPay Webhook] Non-deposit event (${event}), ignoring.`);
      return NextResponse.json({ received: true });
    }

    if (status !== "success" && status !== "successful" && status !== "00") {
      console.log(`[ZainPay Webhook] Deposit status not successful: ${status}`);
      return NextResponse.json({ received: true });
    }

    // Amount: ZainPay sends kobo, convert to NGN
    const rawAmount = Number(data?.amount ?? 0);
    // Detect whether value is already in NGN or in kobo (values >10000 are likely kobo for >₦100)
    const amountNGN = rawAmount > 10000 ? rawAmount / 100 : rawAmount;

    const accountNumber = String(data?.accountNumber ?? data?.beneficiaryAccountNumber ?? "").trim();
    const txnRef = String(data?.txnRef ?? data?.transactionRef ?? "").trim();

    console.log(`[ZainPay Webhook] Deposit detected — account: ${accountNumber}, amount: ₦${amountNGN}, ref: ${txnRef}`);

    if (!accountNumber) {
      console.error("[ZainPay Webhook] Missing accountNumber in payload");
      return NextResponse.json({ received: true });
    }

    // Find the pending transaction for this virtual account number
    const { data: txRows, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("metadata->>zainpay_account_number", accountNumber)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);

    if (txError) {
      console.error("[ZainPay Webhook] DB error looking up transaction:", txError);
      return NextResponse.json({ received: true });
    }

    if (!txRows || txRows.length === 0) {
      // Fallback: check recently pending transactions (last 2 hours) using contains
      console.warn(`[ZainPay Webhook] No pending tx found for account ${accountNumber}. Trying fallback lookup…`);
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: recentTxs } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("status", "pending")
        .gte("created_at", twoHoursAgo)
        .order("created_at", { ascending: false })
        .limit(20);

      const matched = recentTxs?.find((tx) => {
        const meta = tx.metadata as Record<string, unknown> | null;
        return meta?.zainpay_account_number === accountNumber;
      });

      if (!matched) {
        console.error(`[ZainPay Webhook] No transaction found for account ${accountNumber}`);
        return NextResponse.json({ received: true });
      }
      txRows?.push(matched);
    }

    const txRow = txRows![0];
    const transactionId: string = txRow.transaction_id;

    console.log(`[ZainPay Webhook] Matched transaction: ${transactionId}`);

    // Prevent double-processing
    if (txRow.status === "completed" && txRow.tx_hash) {
      console.log(`[ZainPay Webhook] Transaction ${transactionId} already completed.`);
      return NextResponse.json({ received: true });
    }

    const walletAddress: string =
      txRow.wallet_address ?? (txRow.metadata as Record<string, unknown>)?.wallet_address ?? "";
    const userId: string =
      txRow.user_id ?? (txRow.metadata as Record<string, unknown>)?.user_id ?? "";
    const network: string =
      (txRow.metadata as Record<string, unknown>)?.network as string ?? "send";

    if (!walletAddress) {
      console.error(`[ZainPay Webhook] No wallet address on transaction ${transactionId}`);
      return NextResponse.json({ received: true });
    }

    // Recalculate with current exchange rate and fees
    const exchangeRate = await getExchangeRate();
    const feeNGN = await calculateTransactionFee(amountNGN);
    const feeInSEND = calculateFeeInTokens(feeNGN, exchangeRate);
    const finalSendAmount = calculateFinalTokens(amountNGN, feeNGN, exchangeRate);

    console.log(`[ZainPay Webhook] ₦${amountNGN} → ${finalSendAmount} tokens (rate: ${exchangeRate}, fee: ₦${feeNGN})`);

    // Update transaction with payment details
    await updateTransaction(transactionId, {
      paymentReference: txnRef || `ZAINPAY-${accountNumber}-${Date.now()}`,
      ngnAmount: amountNGN,
      sendAmount: finalSendAmount,
      exchangeRate,
      fee_ngn: feeNGN,
      fee_in_send: feeInSEND,
    });

    // Record revenue
    if (feeNGN > 0) {
      const revenueResult = await recordRevenue(transactionId, feeNGN, feeInSEND);
      if (!revenueResult.success) {
        console.error(`[ZainPay Webhook] Failed to record revenue: ${revenueResult.error}`);
      }
    }

    // Get user email for notifications
    let userEmail: string | null = null;
    if (userId) {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("email")
        .eq("id", userId)
        .single();
      userEmail = user?.email ?? null;
    }

    if (userEmail) {
      try {
        await sendPaymentVerificationEmail(userEmail, amountNGN, txnRef);
      } catch (e) {
        console.error("[ZainPay Webhook] Failed to send payment email:", e);
      }
    }

    // Update referral count on first transaction
    if (userId) {
      try {
        await updateReferralCountOnTransaction(userId);
      } catch (e) {
        console.error("[ZainPay Webhook] Error updating referral count:", e);
      }
    }

    // Distribute tokens — retry up to 3 times
    let distributionResult: { success: boolean; txHash?: string; error?: string } | null = null;
    const retryDelays = [0, 3000, 7000];

    for (let attempt = 1; attempt <= 3; attempt++) {
      if (attempt > 1) {
        await new Promise((r) => setTimeout(r, retryDelays[attempt - 1]));
      }
      console.log(`[ZainPay Webhook] Distributing tokens (attempt ${attempt}/3)…`);
      distributionResult = await distributeTokens(transactionId, walletAddress, finalSendAmount);
      if (distributionResult.success) break;
      console.error(`[ZainPay Webhook] Distribution attempt ${attempt} failed:`, distributionResult.error);
    }

    if (distributionResult?.success && distributionResult.txHash) {
      console.log(`[ZainPay Webhook] ✅ Tokens sent! txHash: ${distributionResult.txHash}`);

      await updateTransaction(transactionId, {
        status: "completed",
        txHash: distributionResult.txHash,
      });

      if (userEmail) {
        try {
          await sendTokenDistributionEmail(userEmail, amountNGN, String(finalSendAmount), walletAddress, distributionResult.txHash);
        } catch (e) {
          console.error("[ZainPay Webhook] Failed to send distribution email:", e);
        }
      }
    } else {
      console.error(`[ZainPay Webhook] ❌ All distribution attempts failed for ${transactionId}:`, distributionResult?.error);

      await supabaseAdmin
        .from("transactions")
        .update({
          status: "pending",
          error_message: distributionResult?.error ?? "Token distribution failed after 3 attempts",
        })
        .eq("transaction_id", transactionId);
    }

    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error("[ZainPay Webhook] Unhandled error:", e?.message ?? e);
    console.error("[ZainPay Webhook] Raw body:", bodyText.slice(0, 500));
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
