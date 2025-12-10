import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { supabaseAdmin } from "@/lib/supabase";
import { BASE_RPC_URL } from "@/lib/constants";

// ERC20 Token ABI (minimal - just what we need)
const ERC20_ABI = [
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
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
] as const;

/**
 * Get public client for Base network
 */
function getPublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL, {
      retryCount: 3,
      retryDelay: 1000,
    }),
  });
}

/**
 * Check wallet for incoming tokens
 * POST /api/offramp/check-token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId } = body;

    if (!transactionId) {
      return NextResponse.json(
        {
          success: false,
          message: "Transaction ID is required",
        },
        { status: 400 }
      );
    }

    // Get transaction from database
    const { data: transaction, error: txError } = await supabaseAdmin
      .from("offramp_transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single();

    if (txError || !transaction) {
      return NextResponse.json(
        {
          success: false,
          message: "Transaction not found",
        },
        { status: 404 }
      );
    }

    // If token already detected, return existing info
    if (transaction.status !== "pending" && transaction.token_address) {
      return NextResponse.json({
        success: true,
        tokenDetected: true,
        tokenAddress: transaction.token_address,
        tokenSymbol: transaction.token_symbol,
        tokenAmount: transaction.token_amount,
        status: transaction.status,
      });
    }

    const walletAddress = transaction.unique_wallet_address;
    const publicClient = getPublicClient();

    // Check native ETH balance first
    const ethBalance = await publicClient.getBalance({
      address: walletAddress as `0x${string}`,
    });

    let detectedToken: {
      address: string | null;
      symbol: string;
      amount: string;
      amountRaw: string;
    } | null = null;

    // If ETH balance > 0, user sent ETH
    if (ethBalance > 0n) {
      const ethAmount = formatUnits(ethBalance, 18);
      detectedToken = {
        address: null, // Native ETH has no contract address
        symbol: "ETH",
        amount: ethAmount,
        amountRaw: ethBalance.toString(),
      };
    } else {
      // Check for common ERC20 tokens on Base
      // We'll check a list of common tokens, or we can scan recent transactions
      // For now, let's check USDC, DAI, WETH as common tokens
      const commonTokens = [
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
        "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // DAI on Base
        "0x4200000000000000000000000000000000000006", // WETH on Base
      ];

      for (const tokenAddress of commonTokens) {
        try {
          const balance = (await publicClient.readContract({
            address: tokenAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [walletAddress as `0x${string}`],
          })) as bigint;

          if (balance > 0n) {
            // Get token metadata
            const decimals = (await publicClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: ERC20_ABI,
              functionName: "decimals",
            })) as number;

            const symbol = (await publicClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: ERC20_ABI,
              functionName: "symbol",
            })) as string;

            const amount = formatUnits(balance, decimals);

            detectedToken = {
              address: tokenAddress,
              symbol,
              amount,
              amountRaw: balance.toString(),
            };
            break; // Found a token, stop checking
          }
        } catch (error) {
          // Token might not exist or contract call failed, continue to next
          console.log(`[Check Token] Could not check token ${tokenAddress}:`, error);
        }
      }
    }

    // If no token detected, return
    if (!detectedToken) {
      return NextResponse.json({
        success: true,
        tokenDetected: false,
        message: "No tokens detected in wallet",
      });
    }

    // Update transaction with detected token info
    const { error: updateError } = await supabaseAdmin
      .from("offramp_transactions")
      .update({
        token_address: detectedToken.address,
        token_symbol: detectedToken.symbol,
        token_amount: detectedToken.amount,
        token_amount_raw: detectedToken.amountRaw,
        status: "token_received",
        token_received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("transaction_id", transactionId);

    if (updateError) {
      console.error("[Check Token] Error updating transaction:", updateError);
      return NextResponse.json(
        {
          success: false,
          message: "Failed to update transaction",
        },
        { status: 500 }
      );
    }

    console.log(`[Check Token] ✅ Token detected: ${detectedToken.symbol} - ${detectedToken.amount}`);

    return NextResponse.json({
      success: true,
      tokenDetected: true,
      tokenAddress: detectedToken.address,
      tokenSymbol: detectedToken.symbol,
      tokenAmount: detectedToken.amount,
      status: "token_received",
    });
  } catch (error) {
    console.error("[Check Token] Error checking token:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "An error occurred",
      },
      { status: 500 }
    );
  }
}

