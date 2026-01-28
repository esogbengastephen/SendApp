import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createTransaction } from "@/lib/transactions";
import { distributeTokens } from "@/lib/token-distribution";
import { getExchangeRate } from "@/lib/settings";
import { calculateTransactionFee, calculateFinalTokens, calculateFeeInTokens } from "@/lib/fee-calculation";

/**
 * TEST ENDPOINT: Simulate "payment received" and trigger token distribution to a wallet.
 * Use for testing: assume user paid NGN, send equivalent SEND to their wallet.
 *
 * POST /api/test/distribute-tokens
 * Body: { walletAddress: string, ngnAmount?: number, sendAmount?: string }
 * - walletAddress: required. Recipient Base wallet (e.g. 0xa66451D101E08cdA725EEaf2960D2515cFfc36F6)
 * - ngnAmount: optional. If provided, we compute sendAmount from admin rate (after fee). Default 250.
 * - sendAmount: optional. If provided, used as the SEND amount to distribute. Otherwise computed from ngnAmount.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, ngnAmount: ngnInput, sendAmount: sendInput } = body;

    if (!walletAddress || typeof walletAddress !== "string" || !walletAddress.trim()) {
      return NextResponse.json(
        { success: false, error: "walletAddress is required" },
        { status: 400 }
      );
    }

    const normalizedWallet = walletAddress.trim().toLowerCase();
    const ngnAmount = typeof ngnInput === "number" && ngnInput > 0 ? ngnInput : 250;
    const exchangeRate = await getExchangeRate();
    const feeNGN = await calculateTransactionFee(ngnAmount);
    const feeInSEND = calculateFeeInTokens(feeNGN, exchangeRate);
    let finalSendAmount: string;

    if (typeof sendInput === "string" && sendInput.trim() && !Number.isNaN(parseFloat(sendInput))) {
      finalSendAmount = sendInput.trim();
    } else {
      finalSendAmount = calculateFinalTokens(ngnAmount, feeNGN, exchangeRate);
      console.log(`[Test Distribute] ${ngnAmount} NGN → ${finalSendAmount} SEND (rate: ${exchangeRate}, fee: ${feeNGN} NGN)`);
    }

    const transactionId = nanoid();
    await createTransaction({
      transactionId,
      paystackReference: `TEST_DIST_${transactionId}`,
      ngnAmount,
      sendAmount: finalSendAmount,
      walletAddress: normalizedWallet,
      exchangeRate,
      fee_ngn: feeNGN,
      fee_in_send: feeInSEND,
    });

    console.log(`[Test Distribute] Created transaction ${transactionId}. Distributing ${finalSendAmount} SEND to ${normalizedWallet}...`);

    const result = await distributeTokens(transactionId, normalizedWallet, finalSendAmount);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Tokens distributed successfully",
        transactionId,
        walletAddress: normalizedWallet,
        sendAmount: finalSendAmount,
        txHash: result.txHash,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: result.error ?? "Distribution failed",
        transactionId,
        walletAddress: normalizedWallet,
        sendAmount: finalSendAmount,
      },
      { status: 500 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Test Distribute] Error:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
