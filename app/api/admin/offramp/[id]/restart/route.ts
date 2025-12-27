import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminWallet } from "@/lib/supabase";
import { SEND_TOKEN_ADDRESS } from "@/lib/constants";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL } from "@/lib/constants";

/**
 * Restart off-ramp transaction and execute full swap process (Admin only)
 * This will:
 * 1. Check for tokens in wallet (or use existing token info)
 * 2. Fund wallet with gas from master wallet
 * 3. Swap tokens to USDC
 * 4. Transfer USDC to receiver wallet
 * 5. Return remaining ETH to master wallet
 * POST /api/admin/offramp/[id]/restart
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { adminWallet } = body;
    
    // Get transaction ID from params - await first
    const resolvedParams = await params;
    
    // Ensure it exists
    if (!resolvedParams || !resolvedParams.id) {
      return NextResponse.json(
        { success: false, error: "Transaction ID is required in URL path" },
        { status: 400 }
      );
    }
    
    // Get transaction ID from params
    // Next.js automatically decodes URL parameters, so params.id should already be decoded
    // But we'll try both raw and decoded versions to be safe
    const rawTransactionId = resolvedParams.id;
    let transactionId = rawTransactionId;
    
    // Try decoding only if it looks encoded (contains %)
    // Ensure rawTransactionId is a string before calling includes
    if (rawTransactionId && typeof rawTransactionId === 'string' && rawTransactionId.includes('%')) {
      try {
        transactionId = decodeURIComponent(rawTransactionId);
      } catch (e) {
        // If decoding fails, use raw
        transactionId = rawTransactionId;
      }
    }

    console.log(`[Restart] Attempting to restart and execute swap for transaction`);
    console.log(`[Restart] Raw params.id: ${rawTransactionId}`);
    console.log(`[Restart] Using transactionId: ${transactionId}`);

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

    // Get transaction - try multiple approaches
    let { data: transaction, error: txError } = await supabaseAdmin
      .from("offramp_transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single();

    // If not found, try the raw ID (in case Next.js didn't decode it)
    if (txError && txError.code === "PGRST116" && rawTransactionId !== transactionId) {
      console.log(`[Restart] Transaction not found with decoded ID, trying raw params.id...`);
      const { data: rawTx, error: rawError } = await supabaseAdmin
        .from("offramp_transactions")
        .select("*")
        .eq("transaction_id", rawTransactionId)
        .single();
      
      if (!rawError && rawTx) {
        transaction = rawTx;
        txError = null;
        console.log(`[Restart] ✅ Found with raw ID: ${rawTransactionId}`);
      }
    }

    // If still not found, try case-insensitive search
    if (txError && txError.code === "PGRST116") {
      console.log(`[Restart] Trying case-insensitive search...`);
      const { data: allTransactions, error: listError } = await supabaseAdmin
        .from("offramp_transactions")
        .select("transaction_id")
        .ilike("transaction_id", transactionId);
      
      if (!listError && allTransactions && allTransactions.length > 0) {
        const actualTransactionId = allTransactions[0].transaction_id;
        console.log(`[Restart] Found transaction with case-insensitive match: ${actualTransactionId}`);
        
        const { data: foundTx, error: foundError } = await supabaseAdmin
          .from("offramp_transactions")
          .select("*")
          .eq("transaction_id", actualTransactionId)
          .single();
        
        if (!foundError && foundTx) {
          transaction = foundTx;
          txError = null;
          console.log(`[Restart] ✅ Found with case-insensitive match`);
        }
      }
    }

    if (txError) {
      console.error(`[Restart] Database error:`, txError);
      console.error(`[Restart] Transaction ID searched: ${transactionId}`);
      console.error(`[Restart] Error code: ${txError.code}`);
      console.error(`[Restart] Error message: ${txError.message}`);
      
      // Check if it's a "not found" error
      if (txError.code === "PGRST116") {
        // Try to list recent transactions to help debug
        const { data: recentTxs } = await supabaseAdmin
          .from("offramp_transactions")
          .select("transaction_id, unique_wallet_address, status")
          .order("created_at", { ascending: false })
          .limit(5);
        
        return NextResponse.json(
          { 
            success: false, 
            error: "Transaction not found",
            transactionId,
            searchedId: transactionId,
            hint: "Please verify the transaction ID exists in the database",
            recentTransactions: recentTxs?.map(t => t.transaction_id) || [],
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: "Database error",
          details: txError.message,
          code: txError.code
        },
        { status: 500 }
      );
    }

    if (!transaction) {
      console.error(`[Restart] Transaction not found: ${transactionId}`);
      return NextResponse.json(
        { 
          success: false, 
          error: "Transaction not found",
          transactionId,
          searchedId: transactionId
        },
        { status: 404 }
      );
    }

    console.log(`[Restart] ✅ Transaction found: ${transaction.transaction_id}, Status: ${transaction.status}`);

    // Check if transaction can be restarted
    if (transaction.status === "completed") {
      return NextResponse.json(
        { success: false, error: "Cannot restart a completed transaction" },
        { status: 400 }
      );
    }

    // Step 1: Check for tokens if not already detected
    let tokenDetected = false;
    if (!transaction.token_address || !transaction.token_amount_raw) {
      console.log(`[Restart] Token not detected yet, checking wallet for tokens...`);
      
      try {
        const publicClient = createPublicClient({
          chain: base,
          transport: http(BASE_RPC_URL),
        });

        // Check SEND token balance
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
          args: [transaction.unique_wallet_address.toLowerCase() as `0x${string}`],
        })) as bigint;

        if (balance > BigInt(0)) {
          const decimals = 18; // SEND has 18 decimals
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
            .eq("transaction_id", transactionId);

          console.log(`[Restart] ✅ Token detected: ${amount} SEND`);
          tokenDetected = true;
        } else {
          return NextResponse.json(
            {
              success: false,
              error: "No tokens found in wallet. Please send tokens to the wallet address first.",
              walletAddress: transaction.unique_wallet_address,
            },
            { status: 400 }
          );
        }
      } catch (error: any) {
        console.error(`[Restart] Error checking for tokens:`, error);
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
      // Token already detected, just reset swap data
      console.log(`[Restart] Token already detected: ${transaction.token_symbol} ${transaction.token_amount}`);
      tokenDetected = true;
      
      // Reset swap and payment data but keep token info
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
        .eq("transaction_id", transactionId);
    }

    if (!tokenDetected) {
      return NextResponse.json(
        {
          success: false,
          error: "No tokens found. Cannot proceed with swap.",
        },
        { status: 400 }
      );
    }

    // Step 2: Trigger the swap process (this will handle gas funding, swap, USDC transfer, and ETH return)
    console.log(`[Restart] Triggering swap process...`);
    
    try {
      const swapResponse = await fetch(`${request.nextUrl.origin}/api/offramp/swap-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
      });

      const swapData = await swapResponse.json();

      if (swapData.success) {
        return NextResponse.json({
          success: true,
          message: "Restart and swap completed successfully!",
          transactionId,
          swapTxHash: swapData.swapTxHash,
          usdcAmount: swapData.usdcAmount,
          details: "Gas funded → Token swapped → USDC transferred → ETH returned",
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: swapData.message || "Swap failed",
            transactionId,
            swapError: swapData.error,
          },
          { status: 500 }
        );
      }
    } catch (error: any) {
      console.error(`[Restart] Error triggering swap:`, error);
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
    console.error("[Admin OffRamp Restart] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

