/**
 * Revenue tracking utilities
 */

import { supabase } from "./supabase";

export interface RevenueRecord {
  id: string;
  transaction_id: string;
  fee_ngn: number;
  fee_in_send: string;
  created_at: Date;
}

/**
 * Record revenue from a transaction fee
 */
export async function recordRevenue(
  transactionId: string,
  feeNGN: number,
  feeInSEND: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("revenue").insert({
      transaction_id: transactionId,
      fee_ngn: feeNGN,
      fee_in_send: feeInSEND,
    });

    if (error) {
      console.error("[Revenue] Error recording revenue:", error);
      return { success: false, error: error.message };
    }

    console.log(`[Revenue] ✅ Recorded revenue: ${feeNGN} NGN (${feeInSEND} $SEND) for transaction ${transactionId}`);
    return { success: true };
  } catch (error: any) {
    console.error("[Revenue] Exception recording revenue:", error);
    return { success: false, error: error.message || "Failed to record revenue" };
  }
}

/**
 * Get total revenue in $SEND
 */
export async function getTotalRevenueInSEND(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("revenue")
      .select("fee_in_send");

    if (error) {
      console.error("[Revenue] Error fetching total revenue:", error);
      return 0;
    }

    const total = (data || []).reduce((sum, record) => {
      return sum + parseFloat(record.fee_in_send || "0");
    }, 0);

    return total;
  } catch (error) {
    console.error("[Revenue] Exception fetching total revenue:", error);
    return 0;
  }
}

