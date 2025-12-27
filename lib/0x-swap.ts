/**
 * 0x Swap API Integration
 * Handles token swaps on Base network using 0x Protocol
 * Documentation: https://0x.org/docs/
 */

import axios from "axios";
import { concat, numberToHex, size } from "viem";

const BASE_CHAIN_ID = 8453; // Base mainnet
const ZEROX_API_URL = "https://api.0x.org/swap/permit2"; // Using v2 API with Permit2

// Get API key from environment (works in Next.js and standalone scripts)
const ZEROX_API_KEY = (() => {
  // Try process.env first (Next.js runtime)
  if (process.env.ZEROX_API_KEY) {
    return process.env.ZEROX_API_KEY;
  }
  
  // For standalone scripts, try to load from .env.local
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(process.cwd(), '.env.local');
    
    if (fs.existsSync(envPath)) {
      const envFile = fs.readFileSync(envPath, 'utf-8');
      const match = envFile.match(/ZEROX_API_KEY\s*=\s*["']?([^"\'\n]+)["']?/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  } catch (e) {
    // Ignore errors in browser/edge runtime
  }
  
  return undefined;
})();

if (!ZEROX_API_KEY) {
  console.warn("⚠️ ZEROX_API_KEY environment variable is not set. Using public API (rate limited).");
} else {
  console.log(`✅ 0x API Key loaded: ${ZEROX_API_KEY.substring(0, 8)}...`);
}

// Permit2 contract address (same across all chains)
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

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
    
    // Always try to get API key (from env or .env.local)
    const apiKey = ZEROX_API_KEY || process.env.ZEROX_API_KEY;
    if (apiKey) {
      headers["0x-api-key"] = apiKey;
      console.log(`[0x] Using API key: ${apiKey.substring(0, 8)}...`);
    } else {
      console.warn("[0x] No API key found - using public API (rate limited)");
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
    
    // Always try to get API key (from env or .env.local)
    const apiKey = ZEROX_API_KEY || process.env.ZEROX_API_KEY;
    if (apiKey) {
      headers["0x-api-key"] = apiKey;
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

    // 0x v2 returns transaction data with Permit2 signature requirements
    return {
      success: true,
      tx: {
        to: response.data.transaction?.to || response.data.to,
        data: response.data.transaction?.data || response.data.data,
        value: response.data.transaction?.value || response.data.value || "0",
        gas: response.data.transaction?.gas || response.data.gas,
        gasPrice: response.data.transaction?.gasPrice || response.data.gasPrice,
        buyAmount: response.data.buyAmount,
        sellAmount: response.data.sellAmount,
        dstAmount: response.data.buyAmount, // For compatibility
        // Include Permit2 data if present
        permit2: response.data.permit2,
        issues: response.data.issues,
        allowanceTarget: response.data.allowanceTarget,
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

/**
 * ERC20 ABI for token approval
 */
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

/**
 * Get gasless swap transaction (Permit2-based)
 * This returns transaction data that requires Permit2 signature
 * @param sellTokenAddress - Source token address (null for native ETH)
 * @param buyTokenAddress - Destination token address (USDC)
 * @param sellAmount - Amount to swap (in wei/smallest unit)
 * @param takerAddress - Address that will execute the swap
 * @param slippagePercentage - Slippage tolerance (default: 1%)
 * @returns Transaction data with Permit2 signature requirements
 */
export async function getGaslessSwapTransaction(
  sellTokenAddress: string | null,
  buyTokenAddress: string,
  sellAmount: string,
  takerAddress: string,
  slippagePercentage: number = 1
): Promise<{
  success: boolean;
  tx?: any;
  error?: string;
  requiresPermit2?: boolean;
}> {
  try {
    // Gasless doesn't support native ETH
    if (!sellTokenAddress) {
      return {
        success: false,
        error: "Gasless swaps do not support native ETH. Use WETH instead.",
      };
    }

    console.log(`[0x Gasless] Getting gasless swap transaction for ${sellTokenAddress}...`);

    // Get swap transaction using Permit2 endpoint
    const swapResult = await getSwapTransaction(
      sellTokenAddress,
      buyTokenAddress,
      sellAmount,
      takerAddress,
      slippagePercentage
    );

    if (!swapResult.success || !swapResult.tx) {
      return {
        success: false,
        error: swapResult.error || "Failed to get gasless swap transaction",
      };
    }

    // Check if Permit2 is actually required (and supported)
    if (!swapResult.tx.permit2 || !swapResult.tx.permit2.eip712) {
      return {
        success: false,
        error: "Token does not support Permit2 gasless swaps",
      };
    }

    console.log(`[0x Gasless] ✅ Gasless transaction ready (Permit2 signature required)`);

    return {
      success: true,
      tx: swapResult.tx,
      requiresPermit2: true,
    };
  } catch (error: any) {
    console.error("[0x Gasless] Error getting gasless transaction:", error);
    return {
      success: false,
      error: error.message || "Failed to get gasless swap transaction",
    };
  }
}

/**
 * Execute a 0x swap with Permit2 signature
 * Handles the complete flow: approve to Permit2, get quote, sign permit, execute swap
 */
export async function executeZeroXSwapWithPermit2(
  sellTokenAddress: string | null,
  buyTokenAddress: string,
  sellAmount: string,
  walletClient: any,
  publicClient: any,
  slippagePercentage: number = 1
): Promise<{
  success: boolean;
  txHash?: string;
  buyAmount?: string;
  error?: string;
}> {
  try {
    const takerAddress = walletClient.account.address;

    // Step 1: Check and approve token to Permit2 contract (if ERC20)
    if (sellTokenAddress) {
      console.log(`[0x Permit2] Checking allowance to Permit2 contract...`);
      
      const currentAllowance = await publicClient.readContract({
        address: sellTokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [takerAddress as `0x${string}`, PERMIT2_ADDRESS as `0x${string}`],
      }) as bigint;

      const sellAmountBigInt = BigInt(sellAmount);

      if (currentAllowance < sellAmountBigInt) {
        console.log(`[0x Permit2] Insufficient allowance. Approving tokens to Permit2...`);
        
        // Approve max amount to Permit2 (one-time approval)
        const maxApproval = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
        
        const approveTxHash = await walletClient.writeContract({
          address: sellTokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [PERMIT2_ADDRESS as `0x${string}`, maxApproval],
        });

        console.log(`[0x Permit2] Approval tx: ${approveTxHash}`);
        
        // Wait for approval
        const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
        
        if (approvalReceipt.status !== "success") {
          return {
            success: false,
            error: "Approval transaction failed",
          };
        }

        console.log(`[0x Permit2] ✅ Approval confirmed`);
        
        // Wait a bit for state sync
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log(`[0x Permit2] ✅ Sufficient allowance already exists`);
      }
    }

    // Step 2: Get swap transaction with Permit2 data
    console.log(`[0x Permit2] Getting swap data...`);
    const swapResult = await getSwapTransaction(
      sellTokenAddress,
      buyTokenAddress,
      sellAmount,
      takerAddress,
      slippagePercentage
    );

    if (!swapResult.success || !swapResult.tx) {
      return {
        success: false,
        error: swapResult.error || "Failed to get swap transaction",
      };
    }

    const swapData = swapResult.tx;

    // Step 3: Check if Permit2 signature is required
    if (swapData.permit2 && swapData.permit2.eip712) {
      console.log(`[0x Permit2] Signing Permit2 message...`);

      // Sign the Permit2 message
      const signature = await walletClient.signTypedData({
        account: walletClient.account,
        domain: swapData.permit2.eip712.domain,
        types: swapData.permit2.eip712.types,
        primaryType: swapData.permit2.eip712.primaryType,
        message: swapData.permit2.eip712.message,
      });

      console.log(`[0x Permit2] ✅ Permit2 message signed: ${signature.slice(0, 20)}...`);

      // Step 4: Append signature to transaction data
      // Format: <original data><signature length (32 bytes)><signature>
      console.log(`[0x Permit2] Appending signature to transaction data...`);
      
      const signatureLengthInHex = numberToHex(size(signature), {
        signed: false,
        size: 32,
      });

      const finalTransactionData = concat([
        swapData.data as `0x${string}`,
        signatureLengthInHex as `0x${string}`,
        signature as `0x${string}`
      ]);

      console.log(`[0x Permit2] Original data length: ${swapData.data?.length || 0}`);
      console.log(`[0x Permit2] Final data length: ${finalTransactionData.length}`);

      // Step 5: Execute the swap transaction
      console.log(`[0x Permit2] Executing swap transaction...`);
      
      // Increase gas limit by 50% for safety with complex Aerodrome routing
      const gasLimit = swapData.gas ? BigInt(Math.floor(Number(swapData.gas) * 1.5)) : BigInt(600000);
      console.log(`[0x Permit2] Gas limit: ${gasLimit.toString()}`);

      const txHash = await walletClient.sendTransaction({
        to: swapData.to as `0x${string}`,
        data: finalTransactionData,
        value: swapData.value ? BigInt(swapData.value) : BigInt(0),
        gas: gasLimit,
      });

      console.log(`[0x Permit2] Transaction sent: ${txHash}`);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status === "success") {
        console.log(`[0x Permit2] ✅ Swap successful!`);
        return {
          success: true,
          txHash,
          buyAmount: swapData.buyAmount || swapData.dstAmount,
        };
      } else {
        console.error(`[0x Permit2] ❌ Transaction failed`);
        return {
          success: false,
          error: "Transaction reverted",
        };
      }
    } else {
      // No Permit2 required, execute directly
      console.log(`[0x Permit2] No Permit2 required, executing directly...`);

      const txHash = await walletClient.sendTransaction({
        to: swapData.to as `0x${string}`,
        data: swapData.data as `0x${string}`,
        value: swapData.value ? BigInt(swapData.value) : BigInt(0),
        gas: swapData.gas ? BigInt(swapData.gas) : undefined,
      });

      console.log(`[0x] Transaction sent: ${txHash}`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status === "success") {
        console.log(`[0x] ✅ Swap successful!`);
        return {
          success: true,
          txHash,
          buyAmount: swapData.buyAmount || swapData.dstAmount,
        };
      } else {
        return {
          success: false,
          error: "Transaction reverted",
        };
      }
    }
  } catch (error: any) {
    console.error("[0x Permit2] Error:", error);
    return {
      success: false,
      error: error.message || "Unknown error during swap",
    };
  }
}
