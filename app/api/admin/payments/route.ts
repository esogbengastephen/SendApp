import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { supabase } from "@/lib/supabase";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API_BASE = "https://api.paystack.co";

/**
 * Fetch Paystack payments and merge with our transaction data from Supabase
 */
export async function GET(request: NextRequest) {
  try {
    // Get all transactions from Supabase
    const { data: allTransactions, error: supabaseError } = await supabase
      .from("transactions")
      .select("*");

    if (supabaseError) {
      console.error("Supabase error:", supabaseError);
      throw supabaseError;
    }

    const transactions = allTransactions || [];
    const transactionsWithPaystack = transactions.filter(
      (t) => t.paystack_reference && t.paystack_reference !== t.transaction_id
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
        (t) => t.paystack_reference === paystackTx.reference
      );

      return {
        reference: paystackTx.reference,
        amount: paystackTx.amount / 100, // Convert from kobo to NGN
        status: paystackTx.status,
        customer: paystackTx.customer?.email || paystackTx.customer?.first_name || "N/A",
        createdAt: paystackTx.created_at,
        verified: matchingTx?.status === "completed" || false,
        transactionId: matchingTx?.transaction_id || null,
        walletAddress: matchingTx?.wallet_address || null,
        sendAmount: matchingTx?.send_amount || null,
        txHash: matchingTx?.tx_hash || null,
      };
    });

    // Sort by date (newest first)
    payments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    console.log(`[Payments API] Retrieved ${payments.length} payments from Paystack, ${transactionsWithPaystack.length} matched with Supabase`);

    return NextResponse.json({
      success: true,
      payments,
    });
  } catch (error: any) {
    console.error("Error fetching payments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch payments", details: error.message },
      { status: 500 }
    );
  }
}
