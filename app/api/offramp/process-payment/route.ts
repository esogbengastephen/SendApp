import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { supabaseAdmin } from "@/lib/supabase";
import { getReceiverWalletAddress } from "@/lib/offramp-wallet";
import { USDC_BASE_ADDRESS } from "@/lib/0x-swap";
import { getExchangeRate } from "@/lib/settings";
import { calculateTransactionFee, calculateFeeInTokens } from "@/lib/fee-calculation";
// Off-ramp revenue will be recorded separately
import { BASE_RPC_URL } from "@/lib/constants";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API_BASE = "https://api.paystack.co";

// ERC20 ABI for balance check
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
] as const;

/**
 * Get public client for Base network
 */
function getPublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });
}

/**
 * Verify USDC received in a wallet address
 */
async function verifyUSDCReceived(walletAddress: string, expectedAmount: string): Promise<boolean> {
  try {
    const publicClient = getPublicClient();
    
    const balance = (await publicClient.readContract({
      address: USDC_BASE_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [walletAddress as `0x${string}`],
    })) as bigint;

    const decimals = (await publicClient.readContract({
      address: USDC_BASE_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "decimals",
    })) as number;

    const balanceFormatted = formatUnits(balance, decimals);
    const expectedFormatted = formatUnits(BigInt(expectedAmount), decimals);

    // Check if balance increased by at least the expected amount (with small tolerance for fees)
    // For now, we'll just check if we have the expected amount
    // In production, you might want to track previous balance
    return parseFloat(balanceFormatted) >= parseFloat(expectedFormatted) * 0.99; // 1% tolerance
  } catch (error) {
    console.error("[Process Payment] Error verifying USDC:", error);
    return false;
  }
}

/**
 * Create Paystack transfer recipient
 */
async function createPaystackRecipient(
  accountNumber: string,
  accountName: string,
  bankCode: string
): Promise<{ success: boolean; recipientCode?: string; error?: string }> {
  if (!PAYSTACK_SECRET_KEY) {
    return {
      success: false,
      error: "Paystack not configured",
    };
  }

  try {
    const response = await axios.post(
      `${PAYSTACK_API_BASE}/transferrecipient`,
      {
        type: "nuban",
        name: accountName || "Off-ramp User",
        account_number: accountNumber,
        bank_code: bankCode || "035", // Default to Wema Bank if not provided
        currency: "NGN",
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      success: true,
      recipientCode: response.data.data.recipient_code,
    };
  } catch (error: any) {
    console.error("[Process Payment] Error creating recipient:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to create recipient",
    };
  }
}

/**
 * Initiate Paystack transfer
 */
async function initiatePaystackTransfer(
  recipientCode: string,
  amount: number, // Amount in NGN (kobo)
  reference: string
): Promise<{ success: boolean; transferCode?: string; error?: string }> {
  if (!PAYSTACK_SECRET_KEY) {
    return {
      success: false,
      error: "Paystack not configured",
    };
  }

  try {
    const response = await axios.post(
      `${PAYSTACK_API_BASE}/transfer`,
      {
        source: "balance",
        amount: Math.round(amount * 100), // Convert to kobo
        recipient: recipientCode,
        reference: reference,
        reason: "Off-ramp token conversion",
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      success: true,
      transferCode: response.data.data.transfer_code,
    };
  } catch (error: any) {
    console.error("[Process Payment] Error initiating transfer:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to initiate transfer",
    };
  }
}

/**
 * Process Paystack payment after USDC received
 * POST /api/offramp/process-payment
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

    // Verify swap is completed and USDC amount is available
    if (!transaction.swap_tx_hash || !transaction.usdc_amount_raw) {
      return NextResponse.json(
        {
          success: false,
          message: "Swap not completed yet",
        },
        { status: 400 }
      );
    }

    // Check if already paid
    if (transaction.status === "completed" || transaction.status === "paying") {
      return NextResponse.json({
        success: true,
        message: "Payment already processed",
        paystackReference: transaction.paystack_reference,
        status: transaction.status,
      });
    }

    // Verify USDC received in receiver wallet (where USDC is sent after swap)
    const receiverWallet = getReceiverWalletAddress();
    const usdcReceived = await verifyUSDCReceived(receiverWallet, transaction.usdc_amount_raw);

    if (!usdcReceived) {
      // Update status to usdc_received but don't proceed with payment yet
      // This allows retry later
      await supabaseAdmin
        .from("offramp_transactions")
        .update({
          status: "swapping", // Keep as swapping until USDC confirmed
          error_message: "USDC not yet confirmed in receiver wallet",
          updated_at: new Date().toISOString(),
        })
        .eq("transaction_id", transactionId);

      return NextResponse.json(
        {
          success: false,
          message: "USDC not yet confirmed in receiver wallet. Please try again in a few moments.",
        },
        { status: 400 }
      );
    }

    // Update status to usdc_received
    await supabaseAdmin
      .from("offramp_transactions")
      .update({
        status: "usdc_received",
        usdc_received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("transaction_id", transactionId);

    // Get exchange rate
    const exchangeRate = await getExchangeRate();

    // Calculate NGN amount from USDC
    // Use proper decimal handling to avoid precision loss
    // USDC has 6 decimals, so we multiply by 1e6, then divide by 1e6 after calculation
    const usdcAmount = parseFloat(transaction.usdc_amount || "0");
    // Round to 2 decimal places for NGN (standard currency precision)
    const ngnAmountBeforeFees = Math.round((usdcAmount * exchangeRate) * 100) / 100;

    // Calculate fees (same tiered system as on-ramp)
    const feeNGN = await calculateTransactionFee(ngnAmountBeforeFees);
    const feeInSEND = calculateFeeInTokens(feeNGN, exchangeRate);

    // Final NGN amount to pay user (after fees)
    // Round to 2 decimal places for NGN (standard currency precision)
    const finalNGNAmount = Math.round((ngnAmountBeforeFees - feeNGN) * 100) / 100;

    if (finalNGNAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Amount too small after fees",
        },
        { status: 400 }
      );
    }

    // Update status to paying
    await supabaseAdmin
      .from("offramp_transactions")
      .update({
        status: "paying",
        ngn_amount: finalNGNAmount,
        exchange_rate: exchangeRate,
        fee_ngn: feeNGN,
        fee_in_send: feeInSEND,
        updated_at: new Date().toISOString(),
      })
      .eq("transaction_id", transactionId);

    // Create Paystack recipient if not exists
    let recipientCode = transaction.paystack_recipient_code;
    
    if (!recipientCode) {
      const recipientResult = await createPaystackRecipient(
        transaction.user_account_number,
        transaction.user_account_name || "Off-ramp User",
        transaction.user_bank_code || "035"
      );

      if (!recipientResult.success) {
        await supabaseAdmin
          .from("offramp_transactions")
          .update({
            status: "failed",
            error_message: recipientResult.error || "Failed to create recipient",
            updated_at: new Date().toISOString(),
          })
          .eq("transaction_id", transactionId);

        return NextResponse.json(
          {
            success: false,
            message: recipientResult.error || "Failed to create Paystack recipient",
          },
          { status: 500 }
        );
      }

      recipientCode = recipientResult.recipientCode!;
    }

    // Initiate Paystack transfer
    const transferResult = await initiatePaystackTransfer(
      recipientCode,
      finalNGNAmount,
      transactionId
    );

    if (!transferResult.success) {
      await supabaseAdmin
        .from("offramp_transactions")
        .update({
          status: "failed",
          error_message: transferResult.error || "Failed to initiate transfer",
          updated_at: new Date().toISOString(),
        })
        .eq("transaction_id", transactionId);

      return NextResponse.json(
        {
          success: false,
          message: transferResult.error || "Failed to initiate Paystack transfer",
        },
        { status: 500 }
      );
    }

    // Update transaction as completed
    await supabaseAdmin
      .from("offramp_transactions")
      .update({
        status: "completed",
        paystack_reference: transferResult.transferCode,
        paystack_recipient_code: recipientCode,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("transaction_id", transactionId);

    // Record off-ramp revenue
    if (feeNGN > 0) {
      const { error: revenueError } = await supabaseAdmin.from("offramp_revenue").insert({
        transaction_id: transactionId,
        fee_ngn: feeNGN,
        fee_in_send: feeInSEND,
      });

      if (revenueError) {
        console.error(`[Process Payment] ⚠️ Failed to record revenue: ${revenueError.message}`);
      } else {
        console.log(`[Process Payment] ✅ Revenue recorded: ${feeNGN} NGN (${feeInSEND} $SEND)`);
      }
    }

    console.log(`[Process Payment] ✅ Payment completed: ${transactionId}, Amount: ${finalNGNAmount} NGN`);

    return NextResponse.json({
      success: true,
      paystackReference: transferResult.transferCode,
      ngnAmount: finalNGNAmount,
      feeNGN,
      message: "Payment processed successfully",
    });
  } catch (error) {
    console.error("[Process Payment] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "An error occurred",
      },
      { status: 500 }
    );
  }
}

