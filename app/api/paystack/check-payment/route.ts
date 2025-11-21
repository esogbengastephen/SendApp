import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { getTransactionByReference, updateTransaction } from "@/lib/transactions";
import { distributeTokens } from "@/lib/token-distribution";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API_BASE = "https://api.paystack.co";

/**
 * Check for recent payments and verify if payment matches transaction
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, ngnAmount } = body;

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    if (!ngnAmount) {
      return NextResponse.json(
        { success: false, error: "NGN amount is required" },
        { status: 400 }
      );
    }

    // Get transaction record
    const transaction = getTransactionByReference(transactionId);
    if (!transaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Check if already processed
    if (transaction.status === "completed") {
      return NextResponse.json({
        success: true,
        message: "Transaction already processed",
        txHash: transaction.txHash,
      });
    }

    // Fetch recent transactions from Paystack
    // Check for payments matching the amount (within last 24 hours)
    const amountInKobo = Math.round(parseFloat(ngnAmount) * 100);
    
    try {
      const response = await axios.get(
        `${PAYSTACK_API_BASE}/transaction`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
          params: {
            perPage: 50, // Check last 50 transactions
          },
        }
      );

      const transactions = response.data.data || [];
      
      // Find matching transaction
      // Match by amount and check if it's recent (within last hour)
      const matchingTransaction = transactions.find((tx: any) => {
        const txAmount = tx.amount;
        const txTime = new Date(tx.created_at);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        return (
          txAmount === amountInKobo &&
          txTime > oneHourAgo &&
          tx.status === "success"
        );
      });

      if (!matchingTransaction) {
        return NextResponse.json({
          success: false,
          error: "Payment not found. Please ensure you have sent the exact amount and try again.",
        });
      }

      // Verify the transaction
      const verifyResponse = await axios.get(
        `${PAYSTACK_API_BASE}/transaction/verify/${matchingTransaction.reference}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      const verifiedTx = verifyResponse.data.data;

      if (verifiedTx.status !== "success") {
        return NextResponse.json({
          success: false,
          error: "Payment verification failed. Transaction status is not successful.",
        });
      }

      // Update transaction status
      updateTransaction(transaction.transactionId, {
        status: "completed",
        paystackReference: verifiedTx.reference,
      });

      // Distribute tokens
      console.log(`Payment verified. Distributing tokens...`);
      console.log(`Wallet: ${transaction.walletAddress}, Amount: ${transaction.sendAmount} SEND`);

      const distributionResult = await distributeTokens(
        transaction.transactionId,
        transaction.walletAddress,
        transaction.sendAmount
      );

      if (distributionResult.success) {
        return NextResponse.json({
          success: true,
          message: "Payment verified and tokens distributed successfully",
          txHash: distributionResult.txHash,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: `Payment verified but token distribution failed: ${distributionResult.error}`,
        });
      }
    } catch (paystackError: any) {
      console.error("Paystack API error:", paystackError);
      return NextResponse.json(
        {
          success: false,
          error: paystackError.response?.data?.message || "Failed to check payment",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Payment check error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

