import { NextRequest, NextResponse } from "next/server";
import { verifyDynamicVAPayment } from "@/lib/zainpay";
import { supabaseAdmin } from "@/lib/supabase";
import { getTransaction, updateTransaction } from "@/lib/transactions";
import { distributeTokens } from "@/lib/token-distribution";
import { getExchangeRate } from "@/lib/settings";
import { calculateTransactionFee, calculateFinalTokens, calculateFeeInTokens } from "@/lib/fee-calculation";
import { recordRevenue } from "@/lib/revenue";
import { sendPaymentVerificationEmail, sendTokenDistributionEmail } from "@/lib/transaction-emails";
import { updateReferralCountOnTransaction } from "@/lib/supabase";

/**
 * GET /api/zainpay/verify-payment?transactionId=xxx
 *
 * Called by the frontend every few seconds while waiting for payment.
 * Checks ZainPay's deposit verification API to see if the user paid.
 * If paid, triggers token distribution immediately.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const transactionId = searchParams.get("transactionId");

  if (!transactionId) {
    return NextResponse.json({ success: false, error: "transactionId required" }, { status: 400 });
  }

  try {
    // Check our DB first — already completed?
    const tx = await getTransaction(transactionId);
    if (!tx) {
      return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 });
    }

    if (tx.status === "completed" && tx.txHash) {
      return NextResponse.json({ success: true, paid: true, status: "completed", txHash: tx.txHash });
    }

    // Ask ZainPay if payment has been received
    // txnRef = transactionId (we set txnRef: txId when creating the dynamic VA)
    const verifyResult = await verifyDynamicVAPayment(transactionId);

    if (!verifyResult.paid) {
      return NextResponse.json({ success: true, paid: false, status: tx.status });
    }

    // Atomic claim: flip status pending→processing.
    // Prevents double-distribution if webhook fires at the same time as this poller.
    const { data: claimed } = await supabaseAdmin
      .from("transactions")
      .update({ status: "processing" })
      .eq("transaction_id", transactionId)
      .in("status", ["pending"])
      .select("transaction_id")
      .maybeSingle();

    if (!claimed) {
      console.log(`[ZainPay Verify] Transaction ${transactionId} already claimed by another request — skipping.`);
      // Re-check DB — might now be completed by webhook
      const refreshed = await getTransaction(transactionId);
      if (refreshed?.status === "completed" && refreshed.txHash) {
        return NextResponse.json({ success: true, paid: true, status: "completed", txHash: refreshed.txHash });
      }
      return NextResponse.json({ success: true, paid: true, status: "processing" });
    }

    // Payment confirmed by ZainPay — distribute tokens
    console.log(`[ZainPay Verify] ✅ Claimed ${transactionId} — distributing tokens, ₦${verifyResult.amountNGN}`);

    const amountNGN = verifyResult.amountNGN ?? tx.ngnAmount ?? 0;
    const walletAddress: string = tx.walletAddress ?? "";
    const userId: string = tx.userId ?? "";

    if (!walletAddress) {
      return NextResponse.json({ success: false, error: "No wallet address on transaction" }, { status: 400 });
    }

    // Recalculate with current rate
    const exchangeRate = await getExchangeRate();
    const feeNGN = await calculateTransactionFee(amountNGN);
    const feeInSEND = calculateFeeInTokens(feeNGN, exchangeRate);
    const finalSendAmount = calculateFinalTokens(amountNGN, feeNGN, exchangeRate);

    await updateTransaction(transactionId, {
      paymentReference: `ZAINPAY-DVA-${transactionId}`,
      ngnAmount: amountNGN,
      sendAmount: finalSendAmount,
      exchangeRate,
      fee_ngn: feeNGN,
      fee_in_send: feeInSEND,
    });

    if (feeNGN > 0) {
      await recordRevenue(transactionId, feeNGN, feeInSEND).catch(() => {});
    }

    // Get user email
    let userEmail: string | null = null;
    if (userId) {
      const { data: user } = await supabaseAdmin.from("users").select("email").eq("id", userId).single();
      userEmail = user?.email ?? null;
    }

    if (userEmail) {
      sendPaymentVerificationEmail(userEmail, amountNGN, transactionId).catch(() => {});
    }

    if (userId) {
      updateReferralCountOnTransaction(userId).catch(() => {});
    }

    // Distribute tokens — retry up to 3 times
    let distributionResult: { success: boolean; txHash?: string; error?: string } | null = null;
    const retryDelays = [0, 3000, 7000];

    for (let attempt = 1; attempt <= 3; attempt++) {
      if (attempt > 1) await new Promise((r) => setTimeout(r, retryDelays[attempt - 1]));
      console.log(`[ZainPay Verify] Distributing tokens (attempt ${attempt}/3)…`);
      distributionResult = await distributeTokens(transactionId, walletAddress, finalSendAmount);
      if (distributionResult.success) break;
    }

    if (distributionResult?.success && distributionResult.txHash) {
      await updateTransaction(transactionId, { status: "completed", txHash: distributionResult.txHash });

      if (userEmail) {
        sendTokenDistributionEmail(userEmail, amountNGN, String(finalSendAmount), walletAddress, distributionResult.txHash).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        paid: true,
        status: "completed",
        txHash: distributionResult.txHash,
      });
    }

    return NextResponse.json({
      success: false,
      paid: true,
      status: "pending",
      error: distributionResult?.error ?? "Token distribution failed",
    });
  } catch (e: any) {
    console.error("[ZainPay Verify] Error:", e?.message);
    return NextResponse.json({ success: false, error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
