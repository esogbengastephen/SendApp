/**
 * Smart Swap Router
 * Intelligently routes swaps with 3-layer cascade for maximum efficiency and reliability
 * 
 * Strategy (Cascading Fallback):
 * Layer 1: Try 0x Gasless (Permit2) - No ETH gas needed, fees deducted from output
 * Layer 2: Try 0x Traditional - Requires ETH gas, better aggregation
 * Layer 3: Fallback to Aerodrome - Requires ETH gas, most reliable for SEND
 * 
 * Each layer only executes if the previous one fails.
 */

import { SEND_TOKEN_ADDRESS } from "./constants";
import { getSwapTransaction as get0xSwapTransaction, getGaslessSwapTransaction } from "./0x-swap";
import { getAerodromeSwapTransaction } from "./aerodrome-swap";

/**
 * Smart swap transaction result
 */
export interface SmartSwapResult {
  success: boolean;
  tx?: any;
  error?: string;
  provider?: "0x-gasless" | "0x" | "aerodrome"; // Which method was used
  gasRequired?: boolean; // Whether ETH gas is needed for this swap
  layerUsed?: 1 | 2 | 3; // Which layer succeeded
}

/**
 * Get swap transaction using intelligent 3-layer cascading routing
 * @param sellTokenAddress - Source token address (null for native ETH)
 * @param buyTokenAddress - Destination token address (USDC)
 * @param sellAmount - Amount to swap (in wei/smallest unit)
 * @param takerAddress - Address that will execute the swap
 * @param slippagePercentage - Slippage tolerance (default: 1%)
 * @returns Swap transaction data with provider info and gas requirements
 */
export async function getSmartSwapTransaction(
  sellTokenAddress: string | null,
  buyTokenAddress: string,
  sellAmount: string,
  takerAddress: string,
  slippagePercentage: number = 1
): Promise<SmartSwapResult> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[Smart Swap] 🎯 3-Layer Cascade Routing`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Sell Token: ${sellTokenAddress || "ETH"}`);
  console.log(`Buy Token: ${buyTokenAddress}`);
  console.log(`Amount: ${sellAmount}`);
  console.log(`Taker: ${takerAddress}`);

  // ==================================================================
  // SPECIAL CASE: SEND Token - Skip 0x, use Aerodrome directly
  // ==================================================================
  // Reason: 0x API returns quotes for SEND but transactions ALWAYS revert on-chain
  // Evidence: Multiple failed txs to 0x Exchange Proxy (0x785648...)
  // Solution: Aerodrome has DIRECT SEND → USDC liquidity (confirmed working: 10 SEND → 0.20 USDC)
  if (sellTokenAddress && sellTokenAddress.toLowerCase() === SEND_TOKEN_ADDRESS.toLowerCase()) {
    console.log(`\n[Smart Swap] 🎯 SEND TOKEN DETECTED!`);
    console.log(`[Smart Swap] ⚡ SKIPPING Layers 1 & 2 (0x known to revert for SEND)`);
    console.log(`[Smart Swap] 🚀 Going DIRECTLY to Layer 3 (Aerodrome - proven working)`);
    console.log(`[Smart Swap] Evidence: TX 0x428ec... succeeded with Aerodrome (10 SEND → 0.20 USDC)`);

    const aerodromeResult = await getAerodromeSwapTransaction(
      sellTokenAddress,
      buyTokenAddress,
      sellAmount,
      takerAddress,
      slippagePercentage
    );

    if (aerodromeResult.success) {
      console.log(`[Smart Swap] ✅ LAYER 3 SUCCESS - Aerodrome swap ready for SEND!`);
      console.log(`[Smart Swap] 💰 Cost: ~0.0002 ETH (~$0.60) for gas`);
      console.log(`[Smart Swap] 📝 Requires: ETH funding + approval + swap`);
      return {
        success: true,
        tx: aerodromeResult.tx,
        provider: "aerodrome",
        gasRequired: true,
        layerUsed: 3,
      };
    }

    console.error(`[Smart Swap] ❌ Aerodrome failed for SEND: ${aerodromeResult.error}`);
    return {
      success: false,
      error: `Aerodrome swap failed for SEND token: ${aerodromeResult.error}`,
    };
  }

  // ==================================================================
  // LAYER 1: Try 0x Gasless (Permit2)
  // ==================================================================
  console.log(`\n[Smart Swap] 🎯 LAYER 1: Trying 0x GASLESS (Permit2)...`);
  console.log(`[Smart Swap] Benefits: Free approval (Permit2 signature), only pay gas for swap`);
  
  const gaslessResult = await getGaslessSwapTransaction(
    sellTokenAddress,
    buyTokenAddress,
    sellAmount,
    takerAddress,
    slippagePercentage
  );

  if (gaslessResult.success && gaslessResult.tx) {
    console.log(`[Smart Swap] ✅ LAYER 1 SUCCESS - Gasless swap ready!`);
    console.log(`[Smart Swap] 💰 Cost: Approval is free (Permit2), swap tx needs ETH`);
    console.log(`[Smart Swap] 📝 Requires: Permit2 signature (no approval gas) + ETH for swap tx`);
    return {
      success: true,
      tx: gaslessResult.tx,
      provider: "0x-gasless",
      gasRequired: true, // Need ETH for swap transaction (approval is free)
      layerUsed: 1,
    };
  }

  console.log(`[Smart Swap] ⚠️  LAYER 1 FAILED: ${gaslessResult.error}`);
  console.log(`[Smart Swap] Falling back to Layer 2...`);

  // ==================================================================
  // LAYER 2: Try 0x Traditional - Requires ETH gas
  // ==================================================================
  console.log(`\n[Smart Swap] 🎯 LAYER 2: Trying 0x TRADITIONAL (with ETH gas)...`);
  console.log(`[Smart Swap] Benefits: Best aggregation, good liquidity`);
  
  const zeroXResult = await get0xSwapTransaction(
    sellTokenAddress,
    buyTokenAddress,
    sellAmount,
    takerAddress,
    slippagePercentage
  );

  if (zeroXResult.success && zeroXResult.tx) {
    console.log(`[Smart Swap] ✅ LAYER 2 SUCCESS - 0x traditional swap ready!`);
    console.log(`[Smart Swap] 💰 Cost: ~0.0002 ETH (~$0.60) for gas`);
    console.log(`[Smart Swap] 📝 Requires: ETH funding + approval + swap`);
    return {
      success: true,
      tx: zeroXResult.tx,
      provider: "0x",
      gasRequired: true, // ETH funding needed
      layerUsed: 2,
    };
  }

  console.log(`[Smart Swap] ⚠️  LAYER 2 FAILED: ${zeroXResult.error}`);
  console.log(`[Smart Swap] Falling back to Layer 3...`);

  // ==================================================================
  // LAYER 3: Fallback to Aerodrome - Requires ETH gas, most reliable
  // ==================================================================
  console.log(`\n[Smart Swap] 🎯 LAYER 3: Trying AERODROME (last resort)...`);
  console.log(`[Smart Swap] Benefits: Most reliable for SEND, direct DEX integration`);

  // Only try Aerodrome if we have a token address (not native ETH)
  if (!sellTokenAddress) {
    console.error(`[Smart Swap] ❌ LAYER 3 SKIPPED: Aerodrome doesn't support native ETH`);
    console.error(`[Smart Swap] ❌ ALL LAYERS FAILED`);
    return {
      success: false,
      error: `All 3 layers failed. Layer 1 (Gasless): ${gaslessResult.error}. Layer 2 (0x): ${zeroXResult.error}. Layer 3: Native ETH not supported.`,
    };
  }

  const aerodromeResult = await getAerodromeSwapTransaction(
    sellTokenAddress,
    buyTokenAddress,
    sellAmount,
    takerAddress,
    slippagePercentage
  );

  if (aerodromeResult.success) {
    console.log(`[Smart Swap] ✅ LAYER 3 SUCCESS - Aerodrome swap ready!`);
    console.log(`[Smart Swap] 💰 Cost: ~0.0002 ETH (~$0.60) for gas`);
    console.log(`[Smart Swap] 📝 Requires: ETH funding + approval + swap`);
    return {
      success: true,
      tx: aerodromeResult.tx,
      provider: "aerodrome",
      gasRequired: true, // ETH funding needed
      layerUsed: 3,
    };
  }

  // ==================================================================
  // ALL LAYERS FAILED
  // ==================================================================
  console.error(`\n[Smart Swap] ❌ ALL 3 LAYERS FAILED`);
  console.error(`[Smart Swap] Layer 1 (Gasless): ${gaslessResult.error}`);
  console.error(`[Smart Swap] Layer 2 (0x): ${zeroXResult.error}`);
  console.error(`[Smart Swap] Layer 3 (Aerodrome): ${aerodromeResult.error}`);
  
  return {
    success: false,
    error: `All 3 swap layers failed. Gasless: ${gaslessResult.error}. 0x: ${zeroXResult.error}. Aerodrome: ${aerodromeResult.error}`,
  };
}

/**
 * Check if a token should use Aerodrome directly
 * @param tokenAddress - Token address to check
 * @returns true if should use Aerodrome, false otherwise
 */
export function shouldUseAerodrome(tokenAddress: string | null): boolean {
  // Always try 0x first - it aggregates Aerodrome + other DEXes
  // Aerodrome is only used as fallback when 0x fails
  return false;
}

/**
 * Get recommended DEX for a token
 * @param tokenAddress - Token address
 * @returns Recommended DEX name
 */
export function getRecommendedDEX(tokenAddress: string | null): "0x" | "aerodrome" {
  // 0x is recommended for all tokens (it aggregates including Aerodrome)
  return "0x";
}
