import { transferTokens, estimateGas, isValidBaseAddress } from "./blockchain";
import { updateTransaction, getTransaction } from "./transactions";
import { isValidAddress } from "../utils/validation";
import { swapUsdcToSend, swapUsdcToSendBySellingUsdc } from "./base-onramp-swap";

/** When testing, all SEND is sent to this address instead of the user */
const SEND_TEST_RECIPIENT_ADDRESS = "0xa66451D101E08cdA725EEaf2960D2515cFfc36F6";

function getRecipientAddress(walletAddress: string): string {
  const envOverride = process.env.SEND_TEST_RECIPIENT?.trim();
  if (envOverride && /^0x[a-fA-F0-9]{40}$/.test(envOverride)) {
    console.log(`[Token Distribution] Test mode (SEND_TEST_RECIPIENT): sending to ${envOverride} instead of ${walletAddress}`);
    return envOverride;
  }
  if (process.env.NODE_ENV === "development") {
    console.log(`[Token Distribution] Test mode (development): sending to ${SEND_TEST_RECIPIENT_ADDRESS} instead of ${walletAddress}`);
    return SEND_TEST_RECIPIENT_ADDRESS;
  }
  return walletAddress;
}

/**
 * Distribute $SEND tokens to a recipient after successful payment.
 *
 * Intended setup:
 * - Liquidity pool holds USDC (primary). We swap USDC → SEND via Paraswap/Aerodrome (or 0x) and send to the user.
 * - Keep a small amount of SEND in the pool as fallback: when swap is unavailable (no route, API down, etc.)
 *   we transfer SEND directly from the pool to the user.
 *
 * Flow: swap USDC→SEND (Paraswap/0x) → transfer SEND to user; if swap fails, fall back to direct SEND transfer.
 *
 * Production: webhooks pass the equivalent SEND the user paid for (from admin “price exchange”). We swap USDC
 * for that amount of SEND and send it to the user. options.usdcAmountToSell is optional (test/env override).
 */
export async function distributeTokens(
  transactionId: string,
  walletAddress: string,
  sendAmount: string,
  options?: { usdcAmountToSell?: string }
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // Check if tokens have already been distributed for this transaction
    const transaction = await getTransaction(transactionId);
    if (transaction?.txHash) {
      console.log(`Tokens already distributed for transaction ${transactionId}, txHash: ${transaction.txHash}`);
      return {
        success: true,
        txHash: transaction.txHash,
      };
    }

    // Check if transaction is already completed (prevents duplicate distribution)
    if (transaction?.status === "completed" && transaction.txHash) {
      console.log(`Transaction ${transactionId} already completed with txHash: ${transaction.txHash}`);
      return {
        success: true,
        txHash: transaction.txHash,
      };
    }

    // Validate wallet address (only when not using test recipient)
    const recipient = getRecipientAddress(walletAddress);
    if (recipient === walletAddress && !isValidAddress(walletAddress) && !isValidBaseAddress(walletAddress)) {
      return {
        success: false,
        error: "Invalid wallet address format",
      };
    }

    // 1) Swap USDC → SEND so the liquidity pool has the SEND to send (Paraswap/Aerodrome first, then 0x, then direct transfer)
    let amountToSend = sendAmount;
    const isTestRecipient = recipient.toLowerCase() === SEND_TEST_RECIPIENT_ADDRESS.toLowerCase() || (process.env.SEND_TEST_RECIPIENT && recipient.toLowerCase() === process.env.SEND_TEST_RECIPIENT?.trim().toLowerCase());
    const usdcAmountToSell = options?.usdcAmountToSell?.trim();
    // When sending to test address: swap USDC → ~5 SEND via Aerodrome (sell 0.14 USDC). Set SEND_SWAP_TEST_AMOUNT to override or empty to disable.
    const testSwapAmount = process.env.SEND_SWAP_TEST_AMOUNT !== undefined
      ? process.env.SEND_SWAP_TEST_AMOUNT?.trim() ?? ""
      : (isTestRecipient ? "5" : "");
    const useSellUsdcFirst = process.env.SEND_SWAP_SELL_USDC?.trim();

    // Production: use the amount the user sent (converted to USDC). Sell that much USDC → SEND, send to user.
    if (usdcAmountToSell && parseFloat(usdcAmountToSell) > 0) {
      console.log(`[Token Distribution] Production: selling ${usdcAmountToSell} USDC (user amount) → SEND.`);
      const sellSwapResult = await swapUsdcToSendBySellingUsdc(usdcAmountToSell);
      if (sellSwapResult.success && sellSwapResult.sendAmountReceived) {
        amountToSend = sellSwapResult.sendAmountReceived;
        if (sellSwapResult.swapTxHash) {
          console.log(`[Token Distribution] Swap (sell ${usdcAmountToSell} USDC) tx: ${sellSwapResult.swapTxHash}, SEND received: ${amountToSend}`);
        }
      } else {
        console.error(`[Token Distribution] Production swap failed: ${sellSwapResult.error}`);
        await updateTransaction(transactionId, { status: "failed" });
        return {
          success: false,
          error: `Swap failed: ${sellSwapResult.error ?? "Unknown"}. Could not swap ${usdcAmountToSell} USDC to SEND.`,
        };
      }
    } else if (testSwapAmount) {
      // Test mode: swap USDC → ~testSwapAmount SEND via Aerodrome/Paraswap. Use sell path (e.g. 0.14 USDC → ~5 SEND).
      const testUsdcToSell = process.env.SEND_SWAP_TEST_USDC?.trim() || "0.14";
      console.log(`[Token Distribution] Test swap: selling ${testUsdcToSell} USDC → SEND (target ~${testSwapAmount} SEND via Aerodrome).`);
      const sellSwapResult = await swapUsdcToSendBySellingUsdc(testUsdcToSell);
      if (sellSwapResult.success && sellSwapResult.sendAmountReceived) {
        amountToSend = sellSwapResult.sendAmountReceived;
        if (sellSwapResult.swapTxHash) {
          console.log(`[Token Distribution] Swap (sell ${testUsdcToSell} USDC) tx: ${sellSwapResult.swapTxHash}, SEND received: ${amountToSend}`);
        }
      } else {
        console.warn(`[Token Distribution] Test swap failed: ${sellSwapResult.error}. Falling back.`);
        // In test mode, fail fast with swap error so user can fix (e.g. USDC allowance for Paraswap)
        await updateTransaction(transactionId, { status: "failed" });
        return {
          success: false,
          error: `Test swap failed: ${sellSwapResult.error ?? "Unknown"}. Pool may need to approve USDC for Paraswap/Aerodrome.`,
        };
      }
    } else if (useSellUsdcFirst) {
      console.log(`[Token Distribution] SEND_SWAP_SELL_USDC=${useSellUsdcFirst}: selling ${useSellUsdcFirst} USDC → SEND.`);
      const sellSwapResult = await swapUsdcToSendBySellingUsdc(useSellUsdcFirst);
      if (sellSwapResult.success && sellSwapResult.sendAmountReceived) {
        amountToSend = sellSwapResult.sendAmountReceived;
        console.log(`[Token Distribution] Swap (sell ${useSellUsdcFirst} USDC) tx: ${sellSwapResult.swapTxHash}, SEND received: ${amountToSend}`);
      } else {
        console.warn(`[Token Distribution] Sell ${useSellUsdcFirst} USDC failed: ${sellSwapResult.error}. Falling back.`);
      }
    }

    if (amountToSend === sendAmount && !testSwapAmount) {
      const buySwapResult = await swapUsdcToSend(sendAmount);
      if (buySwapResult.success) {
        if (buySwapResult.swapTxHash) {
          console.log(`[Token Distribution] Swap (buy) tx: ${buySwapResult.swapTxHash}`);
        }
      } else {
        const noRoute = /no Route matched|404|no liquidity/i.test(buySwapResult.error ?? "");
        if (noRoute) {
          const usdcToSell = "1";
          console.warn(`[Token Distribution] Buy path had no route. Trying to sell ${usdcToSell} USDC → SEND.`);
          const sellSwapResult = await swapUsdcToSendBySellingUsdc(usdcToSell);
          if (sellSwapResult.success && sellSwapResult.sendAmountReceived) {
            amountToSend = sellSwapResult.sendAmountReceived;
            console.log(`[Token Distribution] Swap (sell ${usdcToSell} USDC) tx: ${sellSwapResult.swapTxHash}, SEND received: ${amountToSend}`);
          } else {
            console.warn("[Token Distribution] USDC→SEND swap not available. Using direct SEND transfer (pool must hold SEND).");
          }
        } else {
          console.error("[Token Distribution] USDC→SEND swap failed:", buySwapResult.error);
          await updateTransaction(transactionId, { status: "failed" });
          return {
            success: false,
            error: `Swap failed: ${buySwapResult.error ?? "Unknown error"}`,
          };
        }
      }
    }

    // 2) Transfer SEND from pool to recipient (user or test address)
    try {
      const gasEstimate = await estimateGas(recipient, amountToSend);
      console.log(`Gas estimate: ${gasEstimate.toString()}`);
    } catch (gasError) {
      console.error("Gas estimation failed:", gasError);
    }

    const result = await transferTokens(recipient, amountToSend);

    if (result.success) {
      await updateTransaction(transactionId, {
        txHash: result.hash,
        status: "completed",
        walletAddress: walletAddress,
        sendAmount: amountToSend,
        completedAt: new Date(),
      });

      console.log(`[Token Distribution] Transaction ${transactionId} completed:`);
      console.log(`  - Recipient: ${recipient}${recipient !== walletAddress ? ` (test override; user wallet: ${walletAddress})` : ""}`);
      console.log(`  - Amount: ${amountToSend} SEND`);
      console.log(`  - TX Hash: ${result.hash}`);

      return {
        success: true,
        txHash: result.hash,
      };
    }

    await updateTransaction(transactionId, { status: "failed" });
    return {
      success: false,
      error: "Token transfer failed",
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Token distribution error:", error);
    await updateTransaction(transactionId, { status: "failed" });
    return {
      success: false,
      error: message || "Failed to distribute tokens",
    };
  }
}

/**
 * Check if token distribution is ready (payment verified, not already distributed)
 */
export function isDistributionReady(transactionId: string): boolean {
  // This would check transaction status in a real implementation
  // For now, we'll rely on the webhook handler to call this at the right time
  return true;
}

