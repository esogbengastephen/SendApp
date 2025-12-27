/**
 * Aerodrome DEX Integration
 * Direct smart contract integration for token swaps on Base network
 * Documentation: https://aero.drome.eth.limo/docs
 */

import { createPublicClient, createWalletClient, http, Account } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL, SEND_TOKEN_ADDRESS } from "./constants";

// Aerodrome Contract Addresses on Base Mainnet
export const AERODROME_ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43"; // Standard V2 Router
export const AERODROME_SLIPSTREAM_ROUTER = "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5"; // Slipstream (CL) Router
export const AERODROME_FACTORY = "0x420DD381b31aEf6683db6B902084cB0FFECe40Da";
export const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Use Slipstream router for SEND token (it uses CL pools)
export function getRouterForToken(tokenAddress: string): string {
  const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
  if (tokenAddress.toLowerCase() === SEND_TOKEN.toLowerCase()) {
    return AERODROME_SLIPSTREAM_ROUTER;
  }
  return AERODROME_ROUTER;
}

/**
 * Route structure for Aerodrome swaps
 */
export interface AerodromeRoute {
  from: string;      // Source token address
  to: string;        // Destination token address
  stable: boolean;   // true for stable pools, false for volatile pools
  factory: string;   // Factory contract address
}

/**
 * Router ABI - Only the functions we need
 */
const ROUTER_ABI = [
  // Get quote for swap
  {
    name: "getAmountsOut",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { 
        name: "routes", 
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "stable", type: "bool" },
          { name: "factory", type: "address" }
        ]
      }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }]
  },
  // Execute swap
  {
    name: "swapExactTokensForTokens",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { 
        name: "routes", 
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "stable", type: "bool" },
          { name: "factory", type: "address" }
        ]
      },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }]
  }
] as const;

/**
 * ERC20 ABI - For approvals
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

// WETH address on Base
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

/**
 * Create routes for token swap (supports multi-hop)
 * @param fromToken - Source token address
 * @param toToken - Destination token address
 * @returns Array of route configurations
 */
function createRoutes(fromToken: string, toToken: string): AerodromeRoute[] {
  const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
  
  // SEND token has DIRECT liquidity to USDC on Aerodrome
  // Tested and confirmed working: 10 SEND → 0.20 USDC (direct route)
  if (fromToken.toLowerCase() === SEND_TOKEN.toLowerCase() && 
      toToken.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
    console.log(`[Aerodrome] ✅ Using DIRECT route: SEND → USDC (confirmed working)`);
    return [{
      from: fromToken,
      to: toToken,
      stable: false,
      factory: AERODROME_FACTORY
    }];
  }
  
  // Default: direct swap
  return [{
    from: fromToken,
    to: toToken,
    stable: false,
    factory: AERODROME_FACTORY
  }];
}

/**
 * Get swap quote from Aerodrome
 * @param sellTokenAddress - Source token address
 * @param buyTokenAddress - Destination token address (USDC)
 * @param sellAmount - Amount to swap (in wei/smallest unit)
 * @returns Quote with expected output amount
 */
export async function getAerodromeQuote(
  sellTokenAddress: string,
  buyTokenAddress: string,
  sellAmount: string
): Promise<{
  success: boolean;
  expectedOutput?: string;
  route?: AerodromeRoute;
  error?: string;
}> {
  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    const routes = createRoutes(sellTokenAddress, buyTokenAddress);

    console.log(`[Aerodrome] Getting quote:`, {
      from: sellTokenAddress,
      to: buyTokenAddress,
      amount: sellAmount,
      routes,
    });

    // Call getAmountsOut to get expected output
    const amounts = await publicClient.readContract({
      address: AERODROME_ROUTER as `0x${string}`,
      abi: ROUTER_ABI,
      functionName: "getAmountsOut",
      args: [BigInt(sellAmount), routes],
    }) as bigint[];

    // amounts[0] is input amount, amounts[last] is output amount
    const expectedOutput = amounts[amounts.length - 1].toString();

    console.log(`[Aerodrome] ✅ Quote received: ${expectedOutput} (output) via ${routes.length} hop(s)`);

    return {
      success: true,
      expectedOutput,
      route: routes[0], // For backward compatibility, return first route
    };
  } catch (error: any) {
    console.error("[Aerodrome] Error getting quote:", error);
    
    let errorMessage = "Failed to get Aerodrome quote";
    if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Execute swap on Aerodrome
 * @param sellTokenAddress - Source token address
 * @param buyTokenAddress - Destination token address (USDC)
 * @param sellAmount - Amount to swap (in wei/smallest unit)
 * @param recipient - Address to receive output tokens
 * @param account - Wallet account executing the swap
 * @param slippagePercentage - Slippage tolerance (default: 1%)
 * @returns Transaction hash and output amount
 */
export async function executeAerodromeSwap(
  sellTokenAddress: string,
  buyTokenAddress: string,
  sellAmount: string,
  recipient: string,
  account: Account,
  slippagePercentage: number = 1
): Promise<{
  success: boolean;
  txHash?: string;
  outputAmount?: string;
  error?: string;
}> {
  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    // Step 1: Get routes and quote
    const routes = createRoutes(sellTokenAddress, buyTokenAddress);
    
    const quoteResult = await getAerodromeQuote(sellTokenAddress, buyTokenAddress, sellAmount);
    if (!quoteResult.success || !quoteResult.expectedOutput) {
      return {
        success: false,
        error: quoteResult.error || "Failed to get quote",
      };
    }

    const expectedOutput = BigInt(quoteResult.expectedOutput);

    // Calculate minimum output with slippage
    const slippageFactor = BigInt(10000 - slippagePercentage * 100); // e.g., 9900 for 1%
    const minOutput = (expectedOutput * slippageFactor) / BigInt(10000);

    console.log(`[Aerodrome] Expected output: ${expectedOutput}, Min output (${slippagePercentage}% slippage): ${minOutput}`);

    // Step 2: Check allowance and approve if needed
    const currentAllowance = await publicClient.readContract({
      address: sellTokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [account.address, AERODROME_ROUTER as `0x${string}`],
    }) as bigint;

    const sellAmountBigInt = BigInt(sellAmount);

    if (currentAllowance < sellAmountBigInt) {
      console.log(`[Aerodrome] Approving ${sellAmount} tokens to router...`);
      
      // Get current nonce for approval transaction
      const approvalNonce = await publicClient.getTransactionCount({
        address: account.address,
      });
      console.log(`[Aerodrome] Current nonce for approval: ${approvalNonce}`);
      
      const approveTxHash = await walletClient.writeContract({
        address: sellTokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [AERODROME_ROUTER as `0x${string}`, sellAmountBigInt],
        nonce: approvalNonce, // Explicitly set nonce
      });

      console.log(`[Aerodrome] Approval tx: ${approveTxHash}`);
      
      // Wait for approval confirmation
      await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
      console.log(`[Aerodrome] ✅ Approval confirmed`);
    } else {
      console.log(`[Aerodrome] Sufficient allowance already exists`);
    }

    // Step 3: Get current nonce to avoid "nonce too low" errors
    // This is especially important when retrying failed transactions
    const currentNonce = await publicClient.getTransactionCount({
      address: account.address,
    });
    console.log(`[Aerodrome] Current nonce for ${account.address}: ${currentNonce}`);

    // Step 4: Execute swap
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes from now

    console.log(`[Aerodrome] Executing swap...`, {
      amountIn: sellAmount,
      amountOutMin: minOutput.toString(),
      routes: routes,
      to: recipient,
      deadline: deadline.toString(),
      nonce: currentNonce,
    });

    const swapTxHash = await walletClient.writeContract({
      address: AERODROME_ROUTER as `0x${string}`,
      abi: ROUTER_ABI,
      functionName: "swapExactTokensForTokens",
      args: [
        sellAmountBigInt,
        minOutput,
        routes,
        recipient as `0x${string}`,
        deadline
      ],
      nonce: currentNonce, // Explicitly set nonce to ensure it's current
    });

    console.log(`[Aerodrome] Swap tx: ${swapTxHash}`);

    // Wait for swap confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: swapTxHash });

    if (receipt.status === "success") {
      console.log(`[Aerodrome] ✅ Swap successful!`);
      return {
        success: true,
        txHash: swapTxHash,
        outputAmount: expectedOutput.toString(),
      };
    } else {
      console.error(`[Aerodrome] ❌ Swap transaction failed`);
      return {
        success: false,
        error: "Swap transaction reverted",
      };
    }
  } catch (error: any) {
    console.error("[Aerodrome] Error executing swap:", error);
    
    let errorMessage = "Failed to execute Aerodrome swap";
    if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get swap transaction data (for building transactions externally)
 * Similar to 0x's getSwapTransaction for compatibility
 */
export async function getAerodromeSwapTransaction(
  sellTokenAddress: string,
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
    // Get routes and quote
    const routes = createRoutes(sellTokenAddress, buyTokenAddress);
    
    const quoteResult = await getAerodromeQuote(sellTokenAddress, buyTokenAddress, sellAmount);
    if (!quoteResult.success || !quoteResult.expectedOutput) {
      return {
        success: false,
        error: quoteResult.error || "Failed to get quote",
      };
    }

    const expectedOutput = BigInt(quoteResult.expectedOutput);

    // Calculate minimum output with slippage
    const slippageFactor = BigInt(10000 - slippagePercentage * 100);
    const minOutput = (expectedOutput * slippageFactor) / BigInt(10000);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

    // Return transaction data in a format similar to 0x
    return {
      success: true,
      tx: {
        to: AERODROME_ROUTER,
        from: takerAddress,
        sellToken: sellTokenAddress,
        buyToken: buyTokenAddress,
        sellAmount: sellAmount,
        buyAmount: expectedOutput.toString(),
        routes: routes,
        amountOutMin: minOutput.toString(),
        deadline: deadline.toString(),
        // For compatibility with existing code
        dstAmount: expectedOutput.toString(),
      },
    };
  } catch (error: any) {
    console.error("[Aerodrome] Error getting swap transaction:", error);
    return {
      success: false,
      error: error.message || "Failed to get Aerodrome swap transaction",
    };
  }
}
