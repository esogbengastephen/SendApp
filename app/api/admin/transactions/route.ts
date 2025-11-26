import { NextResponse } from "next/server";
import { getAllTransactions, getTransactionsByStatus } from "@/lib/transactions";
import axios from "axios";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API_BASE = "https://api.paystack.co";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let transactions = getAllTransactions();
    
    // If we have no transactions in memory, try to get from Paystack and create transaction records
    if (transactions.length === 0 && PAYSTACK_SECRET_KEY) {
      try {
        const response = await axios.get(
          `${PAYSTACK_API_BASE}/transaction`,
          {
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            },
            params: {
              perPage: 100,
            },
          }
        );

        const paystackTransactions = response.data.data || [];
        
        // Get existing transactions to preserve wallet addresses and SEND amounts
        const existingTransactions = getAllTransactions();
        
        // Convert Paystack transactions to our transaction format
        // Try to match with existing transactions to preserve wallet addresses and SEND amounts
        transactions = paystackTransactions.map((ptx: any) => {
          // Try to find existing transaction by Paystack reference
          const existingTx = existingTransactions.find(
            tx => tx.paystackReference === ptx.reference || tx.transactionId === ptx.reference
          );
          
          return {
            transactionId: ptx.reference || `paystack_${ptx.id}`,
            idempotencyKey: ptx.reference || `paystack_${ptx.id}`,
            paystackReference: ptx.reference,
            ngnAmount: ptx.amount / 100, // Convert from kobo
            // Preserve wallet address and SEND amount from existing transaction if available
            walletAddress: existingTx?.walletAddress || "",
            sendAmount: existingTx?.sendAmount || "0.00",
            status: ptx.status === "success" ? "completed" as const : 
                    ptx.status === "pending" ? "pending" as const : "failed" as const,
            createdAt: new Date(ptx.created_at),
            completedAt: ptx.status === "success" ? new Date(ptx.paid_at || ptx.created_at) : undefined,
            // Preserve additional fields from existing transaction
            txHash: existingTx?.txHash,
            exchangeRate: existingTx?.exchangeRate,
            sendtag: existingTx?.sendtag,
            verificationAttempts: existingTx?.verificationAttempts || 0,
            verificationHistory: existingTx?.verificationHistory || [],
          };
        });
      } catch (error) {
        console.error("Error fetching Paystack transactions:", error);
        // Continue with empty transactions array
      }
    }

    // Filter by status if provided
    if (status && ["pending", "completed", "failed"].includes(status)) {
      transactions = transactions.filter((tx) => tx.status === status);
    }

    // Sort by date (newest first)
    transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json({
      success: true,
      transactions: transactions.map((tx) => ({
        ...tx,
        createdAt: tx.createdAt.toISOString(),
        initializedAt: tx.initializedAt?.toISOString(),
        completedAt: tx.completedAt?.toISOString(),
        lastCheckedAt: tx.lastCheckedAt?.toISOString(),
        verificationHistory: tx.verificationHistory?.map((v) => ({
          ...v,
          createdAt: v.createdAt.toISOString(),
        })),
      })),
    });
  } catch (error: any) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

