import { transferTokens, estimateGas, isValidBaseAddress, getTokenBalance, getLiquidityPoolAddress } from "./blockchain";
import { updateTransaction, getTransaction } from "./transactions";
import { isValidAddress } from "../utils/validation";
import { swapUsdcToSend, swapUsdcToSendBySellingUsdc, getUsdcAmountNeededForSend } from "./base-onramp-swap";

/** When testing, all SEND is sent to this address instead of the user */
const SEND_TEST_RECIPIENT_ADDRESS = "0xa66451D101E08cdA725EEaf2960D2515cFfc36F6";

function getRecipientAddress(walletAddress: string): string {
  // Production: always send to the user's wallet (never override with test address)
  if (process.env.NODE_ENV === "production") {
    return walletAddress;
  }
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
 * for that amount of SEND. We check pool SEND balance: if it equals or exceeds the user’s amount we send exactly
 * that amount; if less we swap more USDC for the shortfall (up to 2 top-ups) until we have enough, then send
 * exactly what the user paid for. We never send more than the user’s amount (cap at sendAmount).
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
    const sendNum = parseFloat(sendAmount);
    /** Total SEND we received from swaps in this run — use this to know if we have enough even when pool balance read is stale */
    let totalSendReceivedFromSwaps = 0;
    const isTestRecipient = recipient.toLowerCase() === SEND_TEST_RECIPIENT_ADDRESS.toLowerCase() || (process.env.SEND_TEST_RECIPIENT && recipient.toLowerCase() === process.env.SEND_TEST_RECIPIENT?.trim().toLowerCase());
    const usdcAmountToSell = options?.usdcAmountToSell?.trim();
    // Only use fixed "test swap" (e.g. 0.14 USDC → ~5 SEND) when SEND_SWAP_TEST_AMOUNT is explicitly set.
    // Otherwise use production path (buy/sell exact sendAmount) even when sending to test address (e.g. simulate 600 NGN → 10.94 SEND).
    const testSwapAmount = (process.env.SEND_SWAP_TEST_AMOUNT?.trim() ?? "") || "";
    const useSellUsdcFirst = process.env.SEND_SWAP_SELL_USDC?.trim();

    // Production: use the amount the user sent (converted to USDC). Sell that much USDC → SEND, send to user.
    if (usdcAmountToSell && parseFloat(usdcAmountToSell) > 0) {
      console.log(`[Token Distribution] Production: selling ${usdcAmountToSell} USDC (user amount) → SEND.`);
      const sellSwapResult = await swapUsdcToSendBySellingUsdc(usdcAmountToSell);
      if (sellSwapResult.success && sellSwapResult.sendAmountReceived) {
        amountToSend = sellSwapResult.sendAmountReceived;
        totalSendReceivedFromSwaps += parseFloat(sellSwapResult.sendAmountReceived);
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
        totalSendReceivedFromSwaps += parseFloat(sellSwapResult.sendAmountReceived);
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
        totalSendReceivedFromSwaps += parseFloat(sellSwapResult.sendAmountReceived);
        console.log(`[Token Distribution] Swap (sell ${useSellUsdcFirst} USDC) tx: ${sellSwapResult.swapTxHash}, SEND received: ${amountToSend}`);
      } else {
        console.warn(`[Token Distribution] Sell ${useSellUsdcFirst} USDC failed: ${sellSwapResult.error}. Falling back.`);
      }
    }

    if (amountToSend === sendAmount && !testSwapAmount) {
      // Try sell path first when we have a quote (Aerodrome direct pool often works better with sell).
      const usdcNeeded = await getUsdcAmountNeededForSend(sendAmount);
      if (usdcNeeded && parseFloat(usdcNeeded) > 0) {
        const usdcNum = parseFloat(usdcNeeded);
        const usdcWithBuffer = (usdcNum * 1.05).toFixed(6); // 5% buffer for slippage
        console.log(`[Token Distribution] Selling ${usdcWithBuffer} USDC (quote: ${usdcNeeded}) to get ~${sendAmount} SEND.`);
        const sellSwapResult = await swapUsdcToSendBySellingUsdc(usdcWithBuffer);
        if (sellSwapResult.success && sellSwapResult.sendAmountReceived) {
          amountToSend = sellSwapResult.sendAmountReceived;
          totalSendReceivedFromSwaps += parseFloat(sellSwapResult.sendAmountReceived);
          console.log(`[Token Distribution] Swap (sell ${usdcWithBuffer} USDC) tx: ${sellSwapResult.swapTxHash}, SEND received: ${amountToSend}`);
        }
      }
      // If no quote or sell path failed, try buy path (buy exactly sendAmount SEND).
      let lastSwapError: string | undefined;
      let swapSucceeded = false; // true when buy or fallback sell got SEND into the pool
      if (amountToSend === sendAmount) {
        let buySwapResult: { success: boolean; error?: string; swapTxHash?: string };
        try {
          buySwapResult = await swapUsdcToSend(sendAmount);
        } catch (e) {
          buySwapResult = { success: false, error: e instanceof Error ? e.message : String(e) };
        }
        if (buySwapResult.success) {
          swapSucceeded = true; // bought exactly sendAmount; pool now has it
          totalSendReceivedFromSwaps += sendNum; // we bought exactly sendAmount
          if (buySwapResult.swapTxHash) {
            console.log(`[Token Distribution] Swap (buy) tx: ${buySwapResult.swapTxHash}`);
          }
        } else {
          lastSwapError = buySwapResult.error ?? "Buy path failed (no error message).";
          // Buy path failed. If we had no quote earlier, try selling a fixed USDC amount (e.g. 1 USDC) to get SEND.
          if (!usdcNeeded || parseFloat(usdcNeeded) <= 0) {
            const fallbackUsdc = process.env.SEND_SWAP_FALLBACK_USDC?.trim() || "1";
            console.warn(`[Token Distribution] No quote for ${sendAmount} SEND. Trying sell ${fallbackUsdc} USDC.`);
            let fallbackSell: { success: boolean; error?: string; sendAmountReceived?: string; swapTxHash?: string };
            try {
              fallbackSell = await swapUsdcToSendBySellingUsdc(fallbackUsdc);
            } catch (e) {
              fallbackSell = { success: false, error: e instanceof Error ? e.message : String(e) };
            }
            if (fallbackSell.success && fallbackSell.sendAmountReceived) {
              amountToSend = fallbackSell.sendAmountReceived;
              swapSucceeded = true;
              console.log(`[Token Distribution] Fallback swap (sell ${fallbackUsdc} USDC) tx: ${fallbackSell.swapTxHash}, SEND received: ${amountToSend}`);
            } else {
              lastSwapError = fallbackSell.error ?? lastSwapError ?? "Sell fallback failed (no error message).";
            }
          } else {
            // We had a quote but sell failed; return buy error.
            console.error("[Token Distribution] Sell and buy paths failed:", buySwapResult.error);
            await updateTransaction(transactionId, { status: "failed" });
            return {
              success: false,
              error: `Could not get ${sendAmount} SEND. Sell failed. Buy: ${buySwapResult.error ?? "unknown"}.`,
            };
          }
        }
      }
      // Only report failure when we really failed (no swap succeeded) and still need SEND.
      if (!swapSucceeded && amountToSend === sendAmount) {
        const details = (lastSwapError && lastSwapError.trim()) ? lastSwapError : "No route or quote (Aerodrome/Paraswap/0x all failed).";
        await updateTransaction(transactionId, { status: "failed" });
        return {
          success: false,
          error: `Could not swap for ${sendAmount} SEND. ${details} Add liquidity to the USDC–SEND pool on Aerodrome if the pool is empty.`,
        };
      }
    }

    // 2) Check pool SEND balance. If less than user's amount, swap more USDC → SEND until we have at least sendAmount (max 3 top-ups).
    if (!testSwapAmount && !Number.isNaN(sendNum) && sendNum > 0) {
      const poolAddress = getLiquidityPoolAddress();
      let poolBalanceNum = parseFloat(await getTokenBalance(poolAddress));
      const maxTopUps = 3;
      let topUpCount = 0;

      while (poolBalanceNum < sendNum && topUpCount < maxTopUps) {
        const shortfall = (sendNum - poolBalanceNum).toFixed(6);
        const shortfallNum = parseFloat(shortfall);
        console.log(`[Token Distribution] Pool has ${poolBalanceNum.toFixed(6)} SEND, user paid for ${sendAmount}. Swapping more for shortfall: ${shortfall} SEND.`);
        let usdcToSell: string | undefined;
        const usdcForShortfall = await getUsdcAmountNeededForSend(shortfall);
        if (usdcForShortfall && parseFloat(usdcForShortfall) > 0) {
          // 20% buffer so we get enough SEND after slippage
          usdcToSell = (parseFloat(usdcForShortfall) * 1.2).toFixed(6);
        }
        // If no quote (e.g. tiny shortfall), sell a small fixed USDC amount to cover the gap
        if (!usdcToSell || parseFloat(usdcToSell) <= 0) {
          const fallbackUsdc = shortfallNum < 1 ? "0.1" : "0.5";
          console.warn(`[Token Distribution] No quote for shortfall ${shortfall}. Selling ${fallbackUsdc} USDC.`);
          usdcToSell = fallbackUsdc;
        }
        const topUpResult = await swapUsdcToSendBySellingUsdc(usdcToSell);
        if (!topUpResult.success || !topUpResult.sendAmountReceived) {
          console.error("[Token Distribution] Top-up swap failed:", topUpResult.error);
          break;
        }
        totalSendReceivedFromSwaps += parseFloat(topUpResult.sendAmountReceived);
        poolBalanceNum = parseFloat(await getTokenBalance(poolAddress));
        topUpCount++;
        console.log(`[Token Distribution] Top-up ${topUpCount}: received ${topUpResult.sendAmountReceived} SEND. Pool balance now: ${poolBalanceNum.toFixed(6)} SEND.`);
      }

      // If we received at least sendAmount from our swaps, we have enough — send what the user bought (don't fail on stale pool balance).
      if (totalSendReceivedFromSwaps >= sendNum) {
        console.log(`[Token Distribution] Swap received ${totalSendReceivedFromSwaps.toFixed(6)} SEND >= ${sendAmount}; sending user amount.`);
        amountToSend = sendAmount;
      } else if (poolBalanceNum < sendNum) {
        console.error(`[Token Distribution] After ${topUpCount} top-up(s), pool has ${poolBalanceNum.toFixed(6)} SEND, swap received ${totalSendReceivedFromSwaps.toFixed(6)} SEND, need ${sendAmount}.`);
        await updateTransaction(transactionId, { status: "failed" });
        return {
          success: false,
          error: `Insufficient SEND: pool has ${poolBalanceNum.toFixed(6)} SEND, need ${sendAmount}. Please try again or contact support.`,
        };
      } else {
        amountToSend = sendAmount; // pool balance says we have enough
      }
    }

    // Never send more than the user's intended amount. Cap at sendAmount.
    const toSendNum = parseFloat(amountToSend);
    if (!Number.isNaN(sendNum) && !Number.isNaN(toSendNum) && toSendNum > sendNum) {
      console.log(`[Token Distribution] Capping transfer at user amount: ${amountToSend} → ${sendAmount} SEND`);
      amountToSend = sendAmount;
    }

    // 3) Transfer SEND from pool to recipient (user or test address)
    // After swaps, allow a short delay so chain/RPC reflects updated pool balance (avoids "Insufficient balance" on Vercel)
    if (totalSendReceivedFromSwaps > 0) {
      const settleMs = 3000;
      console.log(`[Token Distribution] Waiting ${settleMs}ms for chain state before transfer...`);
      await new Promise((r) => setTimeout(r, settleMs));
    }
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

