import { NextRequest, NextResponse } from "next/server";
import { isAdminWallet } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL, SEND_TOKEN_ADDRESS } from "@/lib/constants";

/**
 * Manually trigger swap for a wallet (bypasses token detection)
 * POST /api/admin/offramp/manual-swap
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminWallet, walletAddress, tokenAmount, tokenAmountRaw } = body;

    // Verify admin access
    if (!adminWallet) {
      return NextResponse.json(
        { success: false, error: "Admin wallet address required" },
        { status: 400 }
      );
    }

    const isAdmin = await isAdminWallet(adminWallet);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: "Wallet address is required" },
        { status: 400 }
      );
    }

    // Find transaction by wallet address
    const { data: transaction, error } = await supabaseAdmin
      .from("offramp_transactions")
      .select("*")
      .eq("unique_wallet_address", walletAddress.toLowerCase())
      .single();

    if (error || !transaction) {
      return NextResponse.json(
        {
          success: false,
          error: "Transaction not found for this wallet address",
          walletAddress: walletAddress.toLowerCase(),
        },
        { status: 404 }
      );
    }

    // If token info not set, try to fetch actual balance or use provided/default
    if (!transaction.token_address || !transaction.token_amount_raw) {
      const { parseUnits } = await import("viem");
      
      let actualAmount = tokenAmount;
      let actualAmountRaw = tokenAmountRaw;
      
      // Try to fetch actual balance from blockchain
      try {
        const publicClient = createPublicClient({
          chain: base,
          transport: http(BASE_RPC_URL),
        });

        const balance = (await publicClient.readContract({
          address: SEND_TOKEN_ADDRESS as `0x${string}`,
          abi: [
            {
              constant: true,
              inputs: [{ name: "_owner", type: "address" }],
              name: "balanceOf",
              outputs: [{ name: "", type: "uint256" }],
              type: "function",
            },
            {
              constant: true,
              inputs: [],
              name: "decimals",
              outputs: [{ name: "", type: "uint8" }],
              type: "function",
            },
          ] as const,
          functionName: "balanceOf",
          args: [walletAddress.toLowerCase() as `0x${string}`],
        })) as bigint;

        if (balance > BigInt(0)) {
          const decimals = 18; // SEND has 18 decimals
          actualAmount = formatUnits(balance, decimals);
          actualAmountRaw = balance.toString();
          console.log(`[Manual Swap] Found ${actualAmount} SEND tokens in wallet`);
        } else {
          console.log(`[Manual Swap] No tokens found via RPC, using provided/default amount`);
        }
      } catch (error) {
        console.error(`[Manual Swap] Error fetching balance from RPC:`, error);
        // Continue with provided/default amounts
      }
      
      // Use provided amounts, fetched amounts, or default (50 SEND from BaseScan)
      const finalAmount = actualAmount || tokenAmount || "50";
      const finalAmountRaw = actualAmountRaw || tokenAmountRaw || parseUnits(finalAmount, 18).toString();
      
      // Update transaction with SEND token info
      const updateData: any = {
        token_address: SEND_TOKEN_ADDRESS,
        token_symbol: "SEND",
        token_amount: finalAmount,
        token_amount_raw: finalAmountRaw,
        status: "token_received",
        token_received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabaseAdmin
        .from("offramp_transactions")
        .update(updateData)
        .eq("transaction_id", transaction.transaction_id);

      if (updateError) {
        return NextResponse.json(
          {
            success: false,
            error: "Failed to update transaction",
            details: updateError.message,
          },
          { status: 500 }
        );
      }
    }

    // Now trigger swap
    const swapResponse = await fetch(`${request.nextUrl.origin}/api/offramp/swap-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId: transaction.transaction_id }),
    });

    const swapData = await swapResponse.json();

    return NextResponse.json({
      success: swapData.success,
      message: swapData.success ? "Swap triggered successfully" : "Swap failed",
      transactionId: transaction.transaction_id,
      walletAddress: walletAddress.toLowerCase(),
      swapResult: swapData,
    });
  } catch (error: any) {
    console.error("[Manual Swap] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

