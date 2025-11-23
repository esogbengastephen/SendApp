import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { getAllTransactions } from "@/lib/transactions";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API_BASE = "https://api.paystack.co";

/**
 * Fetch Paystack payments and merge with our transaction data
 */
export async function GET(request: NextRequest) {
  try {
    // Get all our transactions with Paystack references
    const allTransactions = getAllTransactions();
    const transactionsWithPaystack = allTransactions.filter(
      (t) => t.paystackReference && t.paystackReference !== t.transactionId
    );

    // Fetch recent Paystack transactions
    let paystackPayments: any[] = [];
    
    if (PAYSTACK_SECRET_KEY) {
      try {
        const response = await axios.get(
          `${PAYSTACK_API_BASE}/transaction`,
          {
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            },
            params: {
              perPage: 100, // Get last 100 transactions
            },
          }
        );

        paystackPayments = response.data.data || [];
      } catch (error: any) {
        console.error("Error fetching Paystack transactions:", error.message);
        // Continue with just our transaction data if Paystack API fails
      }
    }

    // Merge Paystack data with our transaction data
    const payments = paystackPayments.map((paystackTx: any) => {
      // Find matching transaction in our system
      const matchingTx = transactionsWithPaystack.find(
        (t) => t.paystackReference === paystackTx.reference
      );

      return {
        reference: paystackTx.reference,
        amount: paystackTx.amount / 100, // Convert from kobo to NGN
        status: paystackTx.status,
        customer: paystackTx.customer?.email || paystackTx.customer?.first_name || "N/A",
        createdAt: paystackTx.created_at,
        verified: matchingTx?.status === "completed" || false,
        transactionId: matchingTx?.transactionId || null,
        walletAddress: matchingTx?.walletAddress || null,
        sendAmount: matchingTx?.sendAmount || null,
        txHash: matchingTx?.txHash || null,
      };
    });

    // Sort by date (newest first)
    payments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      payments,
    });
  } catch (error: any) {
    console.error("Error fetching payments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}

