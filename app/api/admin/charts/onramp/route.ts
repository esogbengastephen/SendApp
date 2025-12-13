import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { format, subDays } from "date-fns";

interface ChartData {
  date: string;
  revenue: number;
  transactions: number;
  tokens: number;
}

export async function GET() {
  try {
    const days = 30;
    
    // Query on-ramp transactions from Supabase
    const { data: allTransactions, error } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .gte("created_at", subDays(new Date(), days).toISOString());

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    const transactions = allTransactions || [];
    
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
    
    // Process transactions
    transactions.forEach((tx) => {
      const txDate = new Date(tx.created_at);
      const dateStr = format(txDate, "MMM dd");
      
      const dayData = chartDataMap.get(dateStr);
      if (dayData) {
        dayData.transactions += 1;
        
        // Only count revenue and tokens for completed transactions that actually sent tokens
        if (tx.status === "completed" && tx.tx_hash) {
          dayData.revenue += parseFloat(tx.ngn_amount || "0");
          dayData.tokens += parseFloat(tx.send_amount) || 0;
        }
      }
    });
    
    // Convert map to array
    const revenueData: ChartData[] = Array.from(chartDataMap.values());
    const transactionData: ChartData[] = Array.from(chartDataMap.values());
    
    // Calculate status distribution
    const statusDistribution = {
      completed: transactions.filter((tx) => tx.status === "completed").length,
      pending: transactions.filter((tx) => tx.status === "pending").length,
      failed: transactions.filter((tx) => tx.status === "failed").length,
    };
    
    console.log(`[On-Ramp Charts] Generated chart data for ${days} days, ${transactions.length} transactions`);
    
    return NextResponse.json({
      success: true,
      revenueData,
      transactionData,
      statusDistribution,
    });
  } catch (error: any) {
    console.error("Error fetching on-ramp chart data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch chart data", details: error.message },
      { status: 500 }
    );
  }
}

