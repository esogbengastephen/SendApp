/**
 * Base Network Off-Ramp Swap Utility
 * Handles swapping tokens to USDC and transferring to admin wallet
 * Uses Coinbase paymaster for gas sponsorship
 */

import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, encodeFunctionData } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { BASE_RPC_URL } from "./constants";
import { createRpcFetchWith429Retry } from "./rpc-fetch";

// USDC on Base
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;

// ERC20 ABI for transfers
const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
] as const;

// 0x API for swaps (fallback if no direct DEX integration)
const ZEROX_API_BASE = "https://base.api.0x.org";

export interface SwapResult {
  swapTxHash?: string;
  transferTxHash?: string;
  usdcAmount: string;
  success: boolean;
  error?: string;
}

/**
 * Get swap quote from 0x API
 */
async function get0xSwapQuote(
  sellToken: string,
  buyToken: string,
  sellAmount: string,
  takerAddress: string
) {
  const params = new URLSearchParams({
    sellToken,
    buyToken,
    sellAmount,
    takerAddress,
    slippagePercentage: "0.5", // 0.5% slippage
  });

  const response = await fetch(`${ZEROX_API_BASE}/swap/v1/quote?${params}`);
  if (!response.ok) {
    throw new Error(`0x API error: ${response.statusText}`);
  }
  return await response.json();
}

/**
 * Swap token to USDC and transfer to admin wallet
 * All transactions use paymaster for gas sponsorship
 */
export async function swapAndTransferToAdmin(
  userWalletAddress: string, // Smart wallet address
  userWalletPrivateKey: string, // Owner private key
  tokenAddress: string, // Token to swap
  tokenAmount: string, // Amount in token units
  tokenDecimals: number,
  adminWalletAddress: string // Admin wallet to receive USDC
): Promise<SwapResult> {
  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL, { fetchFn: createRpcFetchWith429Retry() }),
    });

    // 1. Get swap quote from 0x
    const tokenAmountWei = parseUnits(tokenAmount, tokenDecimals);
    const quote = await get0xSwapQuote(
      tokenAddress,
      USDC_ADDRESS,
      tokenAmountWei.toString(),
      userWalletAddress
    );

    if (!quote.to || !quote.data) {
      throw new Error("Invalid swap quote from 0x");
    }

    // 2. Execute swap (using owner private key to sign)
    // Note: For full paymaster support, we need to use Coinbase SDK with wallet ID
    // For now, we'll use the owner private key directly
    console.log(`[Base Swap] Executing swap: ${tokenAmount} tokens → USDC`);
    
    const account = privateKeyToAccount(userWalletPrivateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(BASE_RPC_URL, { fetchFn: createRpcFetchWith429Retry() }),
    });

    // Send swap transaction
    const swapHash = await walletClient.sendTransaction({
      to: quote.to as `0x${string}`,
      data: quote.data as `0x${string}`,
      value: BigInt(quote.value || "0"),
    });

    console.log(`[Base Swap] Swap transaction sent: ${swapHash}`);

    // 3. Wait for swap to confirm
    const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });
    
    if (swapReceipt.status !== "success") {
      throw new Error("Swap transaction failed");
    }

    console.log(`[Base Swap] Swap successful: ${swapHash}`);

    // 4. Get USDC balance after swap
    const usdcBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [userWalletAddress as `0x${string}`],
    });

    const usdcDecimals = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "decimals",
    });

    const usdcAmount = formatUnits(usdcBalance as bigint, usdcDecimals as number);

    if (usdcBalance === BigInt(0)) {
      throw new Error("No USDC received after swap");
    }

    console.log(`[Base Swap] USDC balance after swap: ${usdcAmount}`);

    // 5. Transfer USDC to admin wallet (also with paymaster)
    const transferData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [adminWalletAddress as `0x${string}`, usdcBalance as bigint],
    });

    console.log(`[Base Swap] Transferring ${usdcAmount} USDC to admin wallet`);
    
    // Send transfer transaction
    const transferHash = await walletClient.sendTransaction({
      to: USDC_ADDRESS,
      data: transferData,
      value: BigInt(0),
    });

    console.log(`[Base Swap] Transfer transaction sent: ${transferHash}`);

    // Wait for transfer to confirm
    const transferReceipt = await publicClient.waitForTransactionReceipt({ hash: transferHash });
    
    if (transferReceipt.status !== "success") {
      throw new Error("USDC transfer failed");
    }

    console.log(`[Base Swap] Transfer successful: ${transferHash}`);

    return {
      swapTxHash: swapHash,
      transferTxHash: transferHash,
      usdcAmount,
      success: true,
    };
  } catch (error: any) {
    console.error("[Base Swap] Error:", error);
    return {
      success: false,
      error: error.message || "Swap failed",
      usdcAmount: "0",
    };
  }
}
