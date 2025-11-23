import { NextResponse } from "next/server";
import { getAllTransactions } from "@/lib/transactions";
import { format, subDays } from "date-fns";
import axios from "axios";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API_BASE = "https://api.paystack.co";

interface ChartData {
  date: string;
  revenue: number;
  transactions: number;
  tokens: number;
}

export async function GET() {
  try {
    let allTransactions = getAllTransactions();
    const days = 30;
    
    // If we have no transactions, fetch from Paystack
    if (allTransactions.length === 0 && PAYSTACK_SECRET_KEY) {
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
        
        // Convert Paystack transactions to our format
        allTransactions = paystackTransactions.map((ptx: any) => ({
          transactionId: ptx.reference || `paystack_${ptx.id}`,
          idempotencyKey: ptx.reference || `paystack_${ptx.id}`,
          paystackReference: ptx.reference,
          ngnAmount: ptx.amount / 100,
          sendAmount: "0.00",
          walletAddress: "",
          status: ptx.status === "success" ? "completed" as const : 
                  ptx.status === "pending" ? "pending" as const : "failed" as const,
          createdAt: new Date(ptx.created_at),
          completedAt: ptx.status === "success" ? new Date(ptx.paid_at || ptx.created_at) : undefined,
          verificationAttempts: 0,
          verificationHistory: [],
        }));
      } catch (error) {
        console.error("Error fetching Paystack transactions for charts:", error);
      }
    }
    
    // Initialize chart data for last 30 days
    const chartDataMap = new Map<string, ChartData>();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, "MMM dd");
      chartDataMap.set(dateStr, {
        date: dateStr,
        revenue: 0,
        transactions: 0,
        tokens: 0,
      });
    }
    
    // Process real transactions
    allTransactions.forEach((tx) => {
      const txDate = new Date(tx.createdAt);
      const dateStr = format(txDate, "MMM dd");
      
      // Check if transaction is within the last 30 days
      const thirtyDaysAgo = subDays(new Date(), days);
      if (txDate >= thirtyDaysAgo) {
        const dayData = chartDataMap.get(dateStr);
        if (dayData) {
          dayData.transactions += 1;
          
          // Only count revenue and tokens for completed transactions that actually sent tokens
          if (tx.status === "completed" && tx.txHash) {
            dayData.revenue += tx.ngnAmount;
            dayData.tokens += parseFloat(tx.sendAmount) || 0;
          }
        }
      }
    });
    
    // Convert map to array
    const revenueData: ChartData[] = Array.from(chartDataMap.values());
    const transactionData: ChartData[] = Array.from(chartDataMap.values());
    
    return NextResponse.json({
      success: true,
      revenueData,
      transactionData,
    });
  } catch (error: any) {
    console.error("Error fetching chart data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch chart data" },
      { status: 500 }
    );
  }
}

