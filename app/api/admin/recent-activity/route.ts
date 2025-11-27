import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";

export async function GET() {
  try {
    // Query Supabase for recent transactions (last 10)
    const { data: recentTransactions, error } = await supabase
      .from("transactions")
      .select("*")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    // Format activities
    const activities = (recentTransactions || []).map((tx) => {
      const timestamp = tx.completed_at || tx.created_at;
      const walletShort = tx.wallet_address 
        ? `${tx.wallet_address.slice(0, 6)}...${tx.wallet_address.slice(-4)}`
        : "Unknown";

      return {
        id: tx.transaction_id,
        type: tx.status === "completed" 
          ? "completed" 
          : tx.status === "failed" 
          ? "failed" 
          : "pending",
        message: tx.status === "completed"
          ? `₦${parseFloat(tx.ngn_amount).toLocaleString()} → ${parseFloat(tx.send_amount).toLocaleString()} SEND`
          : tx.status === "failed"
          ? `Transaction failed: ${tx.error_message || "Unknown error"}`
          : `Pending payment of ₦${parseFloat(tx.ngn_amount).toLocaleString()}`,
        time: timestamp ? formatDistanceToNow(new Date(timestamp), { addSuffix: true }) : "Just now",
        amount: parseFloat(tx.ngn_amount),
        wallet: walletShort,
        txHash: tx.tx_hash,
        timestamp: timestamp,
      };
    });

    return NextResponse.json({
      success: true,
      activities,
    });
  } catch (error: any) {
    console.error("Error fetching recent activity:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch recent activity",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

