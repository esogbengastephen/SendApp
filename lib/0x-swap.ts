/**
 * 0x Swap API Integration
 * Handles token swaps on Base network using 0x Protocol
 * Documentation: https://0x.org/docs/
 */

import axios from "axios";

const BASE_CHAIN_ID = 8453; // Base mainnet
const ZEROX_API_URL = "https://api.0x.org/swap/permit2"; // Using v2 Permit2 endpoints
const ZEROX_API_KEY = process.env.ZEROX_API_KEY; // Optional but recommended for higher rate limits

if (!ZEROX_API_KEY) {
  console.warn("⚠️ ZEROX_API_KEY environment variable is not set. Using public API (rate limited).");
}

/**
 * Get swap quote from 0x
 * @param sellTokenAddress - Source token address (null for native ETH)
 * @param buyTokenAddress - Destination token address (USDC)
 * @param sellAmount - Amount to swap (in wei/smallest unit)
 * @param takerAddress - Address that will execute the swap
 * @param slippagePercentage - Slippage tolerance (default: 1%)
 */
export async function getSwapQuote(
  sellTokenAddress: string | null,
  buyTokenAddress: string,
  sellAmount: string,
  takerAddress: string,
  slippagePercentage: number = 1
): Promise<{
  success: boolean;
  quote?: any;
  error?: string;
}> {
  try {
    // 0x uses ETH address for native ETH
    const sellToken = sellTokenAddress || "ETH";
    
    const url = `${ZEROX_API_URL}/quote`;
    const params = {
      sellToken: sellToken,
      buyToken: buyTokenAddress,
      sellAmount: sellAmount,
      taker: takerAddress, // v2 uses 'taker' instead of 'takerAddress'
      slippagePercentage: slippagePercentage / 100, // Convert percentage to decimal (1% = 0.01)
      chainId: BASE_CHAIN_ID, // Base chain ID
    };

    const headers: Record<string, string> = {
      "0x-version": "v2", // Required for v2 API
    };
    if (ZEROX_API_KEY) {
      headers["0x-api-key"] = ZEROX_API_KEY;
    }

    console.log(`[0x] Getting swap quote (v2 Permit2):`, {
      sellToken: params.sellToken,
      buyToken: params.buyToken,
      sellAmount: params.sellAmount,
      taker: params.taker,
      slippagePercentage: params.slippagePercentage,
      chainId: params.chainId,
    });

    const response = await axios.get(url, {
      params,
      headers,
    });

    return {
      success: true,
      quote: response.data,
    };
  } catch (error: any) {
    console.error("[0x] Error getting swap quote:", error);
    
    if (error.response) {
      console.error("[0x] Response status:", error.response.status);
      console.error("[0x] Response data:", JSON.stringify(error.response.data, null, 2));
    }
    
    let errorMessage = "Failed to get swap quote";
    if (error.response?.data) {
      errorMessage = 
        error.response.data.reason ||
        error.response.data.validationErrors?.[0]?.reason ||
        error.response.data.message ||
        JSON.stringify(error.response.data);
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get swap transaction data from 0x
 * @param sellTokenAddress - Source token address (null for native ETH)
 * @param buyTokenAddress - Destination token address (USDC)
 * @param sellAmount - Amount to swap (in wei/smallest unit)
 * @param takerAddress - Address that will execute the swap
 * @param slippagePercentage - Slippage tolerance (default: 1%)
 */
export async function getSwapTransaction(
  sellTokenAddress: string | null,
  buyTokenAddress: string,
  sellAmount: string,
  takerAddress: string,
  slippagePercentage: number = 1
): Promise<{
  success: boolean;
  tx?: any;
  error?: string;
}> {
  try {
    // 0x uses ETH address for native ETH
    const sellToken = sellTokenAddress || "ETH";
    
    const url = `${ZEROX_API_URL}/swap`;
    const params = {
      sellToken: sellToken,
      buyToken: buyTokenAddress,
      sellAmount: sellAmount,
      taker: takerAddress, // v2 uses 'taker' instead of 'takerAddress'
      slippagePercentage: slippagePercentage / 100, // Convert percentage to decimal
      chainId: BASE_CHAIN_ID, // Base chain ID
    };

    const headers: Record<string, string> = {
      "0x-version": "v2", // Required for v2 API
    };
    if (ZEROX_API_KEY) {
      headers["0x-api-key"] = ZEROX_API_KEY;
    }

    console.log(`[0x] Getting swap transaction (v2 Permit2):`, {
      sellToken: params.sellToken,
      buyToken: params.buyToken,
      sellAmount: params.sellAmount,
      taker: params.taker,
      slippagePercentage: params.slippagePercentage,
      chainId: BASE_CHAIN_ID,
    });

    // Try GET first (standard), if it fails with METHOD_NOT_ALLOWED, use quote response
    let response;
    try {
      response = await axios.get(url, {
        params,
        headers,
      });
    } catch (error: any) {
      // If GET fails with METHOD_NOT_ALLOWED, try getting quote first and use its data
      if (error.response?.data?.name === "METHOD_NOT_ALLOWED" || error.response?.status === 405) {
        console.log(`[0x] GET swap failed, trying quote endpoint instead...`);
        const quoteResponse = await axios.get(`${ZEROX_API_URL}/quote`, {
          params,
          headers,
        });
        // Use quote response as swap response (quote contains swap data in v2)
        response = quoteResponse;
      } else {
        throw error;
      }
    }
    
    console.log(`[0x] ✅ Swap transaction received successfully (v2 Permit2)`);

    // 0x v2 returns transaction data in a specific format
    // The response includes: to, data, value, gas, gasPrice, buyAmount, etc.
    // v2 also includes permit2 data if needed
    return {
      success: true,
      tx: {
        to: response.data.to,
        data: response.data.data,
        value: response.data.value || "0",
        gas: response.data.gas,
        gasPrice: response.data.gasPrice,
        // 0x uses buyAmount instead of dstAmount
        dstAmount: response.data.buyAmount,
        buyAmount: response.data.buyAmount,
        sellAmount: response.data.sellAmount,
        // v2 may include permit2 data
        permit2: response.data.permit2,
        ...response.data,
      },
    };
  } catch (error: any) {
    console.error("[0x] Error getting swap transaction:", error);
    
    if (error.response) {
      console.error("[0x] Response status:", error.response.status);
      console.error("[0x] Response data:", JSON.stringify(error.response.data, null, 2));
    }
    
    let errorMessage = "Failed to get swap transaction";
    if (error.response?.data) {
      errorMessage = 
        error.response.data.reason ||
        error.response.data.validationErrors?.[0]?.reason ||
        error.response.data.message ||
        JSON.stringify(error.response.data);
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * USDC address on Base
 */
export const USDC_BASE_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/**
 * 0x Exchange Proxy address on Base
 * This is the contract that executes swaps
 */
export const ZEROX_EXCHANGE_PROXY = "0xDef1C0ded9bec7F1a1670819833240f027b25EfF";
