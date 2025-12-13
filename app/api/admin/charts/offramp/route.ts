import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { format, subDays } from "date-fns";

interface ChartData {
  date: string;
  usdc: number;
  ngn: number;
  transactions: number;
  fees: number;
}

export async function GET() {
  try {
    const days = 30;
    
    // Query off-ramp transactions from Supabase
    const { data: allTransactions, error } = await supabaseAdmin
      .from("offramp_transactions")
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
        usdc: 0,
        ngn: 0,
        transactions: 0,
        fees: 0,
      });
    }
    
    // Process transactions
    transactions.forEach((tx) => {
      const txDate = new Date(tx.created_at);
      const dateStr = format(txDate, "MMM dd");
      
      const dayData = chartDataMap.get(dateStr);
      if (dayData) {
        dayData.transactions += 1;
        
        // Only count for completed transactions
        if (tx.status === "completed") {
          dayData.usdc += parseFloat(tx.usdc_amount || "0");
          dayData.ngn += parseFloat(String(tx.ngn_amount || "0"));
          dayData.fees += parseFloat(String(tx.fee_ngn || "0"));
        }
      }
    });
    
    // Convert map to array
    const usdcData: ChartData[] = Array.from(chartDataMap.values());
    const ngnData: ChartData[] = Array.from(chartDataMap.values());
    const volumeData: ChartData[] = Array.from(chartDataMap.values());
    
    // Calculate status distribution
    const statusDistribution = {
      completed: transactions.filter((tx) => tx.status === "completed").length,
      pending: transactions.filter((tx) => tx.status === "pending" || tx.status === "token_received" || tx.status === "swapping" || tx.status === "usdc_received" || tx.status === "paying").length,
      failed: transactions.filter((tx) => tx.status === "failed").length,
      refunded: transactions.filter((tx) => tx.status === "refunded").length,
    };
    
    console.log(`[Off-Ramp Charts] Generated chart data for ${days} days, ${transactions.length} transactions`);
    
    return NextResponse.json({
      success: true,
      usdcData,
      ngnData,
      volumeData,
      statusDistribution,
    });
  } catch (error: any) {
    console.error("Error fetching off-ramp chart data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch chart data", details: error.message },
      { status: 500 }
    );
  }
}

