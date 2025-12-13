import { NextRequest, NextResponse } from "next/server";
import { isAdminWallet } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL, SEND_TOKEN_ADDRESS } from "@/lib/constants";

/**
 * Restart and execute swap for a wallet address (Admin only)
 * This finds the transaction by wallet address and triggers the full swap process
 * POST /api/admin/offramp/restart-by-wallet
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminWallet, walletAddress } = body;

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
    // Note: Multiple transactions can share the same wallet address
    // Get the most recent pending or token_received transaction, or most recent overall
    const { data: transactions, error } = await supabaseAdmin
      .from("offramp_transactions")
      .select("*")
      .eq("unique_wallet_address", walletAddress.toLowerCase())
      .order("created_at", { ascending: false });

    if (error || !transactions || transactions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Transaction not found for this wallet address",
          walletAddress: walletAddress.toLowerCase(),
        },
        { status: 404 }
      );
    }

    // Prefer pending or token_received transactions, otherwise use most recent
    const transaction = transactions.find(t => 
      t.status === "pending" || t.status === "token_received"
    ) || transactions[0];

    console.log(`[Restart By Wallet] Found transaction: ${transaction.transaction_id}`);

    // Check for tokens if not already detected
    if (!transaction.token_address || !transaction.token_amount_raw) {
      console.log(`[Restart By Wallet] Checking wallet for tokens...`);
      
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
          ] as const,
          functionName: "balanceOf",
          args: [walletAddress.toLowerCase() as `0x${string}`],
        })) as bigint;

        if (balance > BigInt(0)) {
          const decimals = 18;
          const amount = formatUnits(balance, decimals);
          
          // Update transaction with token info
          await supabaseAdmin
            .from("offramp_transactions")
            .update({
              token_address: SEND_TOKEN_ADDRESS,
              token_symbol: "SEND",
              token_amount: amount,
              token_amount_raw: balance.toString(),
              status: "token_received",
              token_received_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("transaction_id", transaction.transaction_id);

          console.log(`[Restart By Wallet] ✅ Token detected: ${amount} SEND`);
        } else {
          return NextResponse.json(
            {
              success: false,
              error: "No tokens found in wallet. Please send tokens to the wallet address first.",
              walletAddress: walletAddress.toLowerCase(),
            },
            { status: 400 }
          );
        }
      } catch (error: any) {
        console.error(`[Restart By Wallet] Error checking for tokens:`, error);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to check for tokens in wallet",
            details: error.message,
          },
          { status: 500 }
        );
      }
    } else {
      // Reset swap data but keep token info
      await supabaseAdmin
        .from("offramp_transactions")
        .update({
          status: "token_received",
          error_message: null,
          swap_tx_hash: null,
          swap_attempts: 0,
          usdc_amount: null,
          usdc_amount_raw: null,
          ngn_amount: null,
          exchange_rate: null,
          fee_ngn: null,
          fee_in_send: null,
          paystack_reference: null,
          paystack_recipient_code: null,
          usdc_received_at: null,
          paid_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("transaction_id", transaction.transaction_id);
    }

    // Trigger the swap process
    console.log(`[Restart By Wallet] Triggering swap process...`);
    
    try {
      const swapResponse = await fetch(`${request.nextUrl.origin}/api/offramp/swap-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: transaction.transaction_id }),
      });

      const swapData = await swapResponse.json();

      if (swapData.success) {
        return NextResponse.json({
          success: true,
          message: "Restart and swap completed successfully!",
          transactionId: transaction.transaction_id,
          walletAddress: walletAddress.toLowerCase(),
          swapTxHash: swapData.swapTxHash,
          usdcAmount: swapData.usdcAmount,
          details: "Gas funded → Token swapped → USDC transferred → ETH returned",
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: swapData.message || "Swap failed",
            transactionId: transaction.transaction_id,
            swapError: swapData.error,
          },
          { status: 500 }
        );
      }
    } catch (error: any) {
      console.error(`[Restart By Wallet] Error triggering swap:`, error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to trigger swap",
          details: error.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[Restart By Wallet] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

