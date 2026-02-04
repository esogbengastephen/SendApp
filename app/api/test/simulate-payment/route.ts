import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { distributeTokens } from "@/lib/token-distribution";
import { getExchangeRate } from "@/lib/settings";
import { calculateSendAmount } from "@/lib/transactions";
import { nanoid } from "nanoid";

/**
 * TEST ENDPOINT: Simulate a payment completion
 * This bypasses Paystack and directly creates a completed transaction
 * FOR TESTING ONLY - Remove in production!
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, walletAddress, ngnAmount, virtualAccountNumber } = await request.json();

    console.log(`[TEST] Simulating payment: ${ngnAmount} NGN to account ${virtualAccountNumber}`);

    if (!userId || !walletAddress || !ngnAmount || !virtualAccountNumber) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify virtual account belongs to this user
    const { data: userWallet, error: walletError } = await supabase
      .from("user_wallets")
      .select("*")
      .eq("user_id", userId)
      .eq("virtual_account_number", virtualAccountNumber)
      .single();

    if (walletError || !userWallet) {
      return NextResponse.json(
        { success: false, error: "Virtual account not found or doesn't belong to user" },
        { status: 404 }
      );
    }

    // Get exchange rate
    const exchangeRate = await getExchangeRate();
    const sendAmount = calculateSendAmount(parseFloat(ngnAmount), exchangeRate);

    console.log(`[TEST] Converting ${ngnAmount} NGN → ${sendAmount} SEND (rate: ${exchangeRate})`);

    // Create completed transaction
    const transactionId = nanoid();
    const now = new Date().toISOString();

    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .insert({
        transaction_id: transactionId,
        user_id: userId,
        wallet_address: walletAddress.toLowerCase(),
        ngn_amount: parseFloat(ngnAmount),
        send_amount: sendAmount,
        status: "completed",
        paystack_reference: `TEST_${transactionId}`,
        exchange_rate: exchangeRate,
        created_at: now,
        completed_at: now,
      })
      .select()
      .single();

    if (txError) {
      console.error("[TEST] Error creating transaction:", txError);
      return NextResponse.json(
        { success: false, error: "Failed to create transaction" },
        { status: 500 }
      );
    }

    console.log(`[TEST] Transaction created: ${transactionId}`);

    // Distribute tokens
    try {
      const distributionResult = await distributeTokens(
        transactionId,
        walletAddress,
        sendAmount
      );

      if (distributionResult.success) {
        console.log(`[TEST] ✅ Tokens distributed! TX: ${distributionResult.txHash}`);
        
        return NextResponse.json({
          success: true,
          message: "Test payment simulated successfully!",
          transactionId,
          txHash: distributionResult.txHash,
          ngnAmount: parseFloat(ngnAmount),
          sendAmount,
        });
      } else {
        console.error(`[TEST] Token distribution failed:`, distributionResult.error);
        await supabase
          .from("transactions")
          .update({
            status: "pending",
            error_message: distributionResult.error,
          })
          .eq("transaction_id", transactionId);

        return NextResponse.json({
          success: false,
          error: "Token distribution failed",
          details: distributionResult.error,
        });
      }
    } catch (distError: any) {
      console.error("[TEST] Distribution error:", distError);
      await supabase
        .from("transactions")
        .update({
          status: "pending",
          error_message: distError.message,
        })
        .eq("transaction_id", transactionId);
      
      return NextResponse.json({
        success: false,
        error: "Distribution error",
        details: distError.message,
      });
    }
  } catch (error: any) {
    console.error("[TEST] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

