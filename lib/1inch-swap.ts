/**
 * 1inch DEX Aggregator Integration
 * Handles token swaps on Base network
 */

import axios from "axios";

const BASE_CHAIN_ID = 8453; // Base mainnet
const ONEINCH_API_URL = "https://api.1inch.dev/swap/v6.0";
const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY;

if (!ONEINCH_API_KEY) {
  console.warn("⚠️ ONEINCH_API_KEY environment variable is not set. Token swaps will fail.");
}

/**
 * Get swap quote from 1inch
 * @param fromTokenAddress - Source token address (null for native ETH)
 * @param toTokenAddress - Destination token address (USDC)
 * @param amount - Amount to swap (in wei/smallest unit)
 * @param fromAddress - Address that will receive the swapped tokens
 */
export async function getSwapQuote(
  fromTokenAddress: string | null,
  toTokenAddress: string,
  amount: string,
  fromAddress: string
): Promise<{
  success: boolean;
  quote?: any;
  error?: string;
}> {
  if (!ONEINCH_API_KEY) {
    return {
      success: false,
      error: "1inch API key not configured",
    };
  }

  try {
    const url = `${ONEINCH_API_URL}/${BASE_CHAIN_ID}/quote`;
    const params = {
      src: fromTokenAddress || "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // Native ETH
      dst: toTokenAddress,
      amount: amount,
      from: fromAddress,
    };

    const response = await axios.get(url, {
      params,
      headers: {
        Authorization: `Bearer ${ONEINCH_API_KEY}`,
      },
    });

    return {
      success: true,
      quote: response.data,
    };
  } catch (error: any) {
    console.error("[1inch] Error getting swap quote:", error);
    return {
      success: false,
      error: error.response?.data?.description || error.message || "Failed to get swap quote",
    };
  }
}

/**
 * Get swap transaction data from 1inch
 * @param fromTokenAddress - Source token address (null for native ETH)
 * @param toTokenAddress - Destination token address (USDC)
 * @param amount - Amount to swap (in wei/smallest unit)
 * @param fromAddress - Address that will receive the swapped tokens
 * @param slippage - Slippage tolerance (default: 1%)
 */
export async function getSwapTransaction(
  fromTokenAddress: string | null,
  toTokenAddress: string,
  amount: string,
  fromAddress: string,
  slippage: number = 1
): Promise<{
  success: boolean;
  tx?: any;
  error?: string;
}> {
  if (!ONEINCH_API_KEY) {
    return {
      success: false,
      error: "1inch API key not configured",
    };
  }

  try {
    const url = `${ONEINCH_API_URL}/${BASE_CHAIN_ID}/swap`;
    const params = {
      src: fromTokenAddress || "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // Native ETH
      dst: toTokenAddress,
      amount: amount,
      from: fromAddress,
      slippage: slippage,
    };

    const response = await axios.get(url, {
      params,
      headers: {
        Authorization: `Bearer ${ONEINCH_API_KEY}`,
      },
    });

    return {
      success: true,
      tx: response.data,
    };
  } catch (error: any) {
    console.error("[1inch] Error getting swap transaction:", error);
    return {
      success: false,
      error: error.response?.data?.description || error.message || "Failed to get swap transaction",
    };
  }
}

/**
 * USDC address on Base
 */
export const USDC_BASE_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

