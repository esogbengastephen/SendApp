/**
 * Revenue tracking utilities
 */

import { supabase, supabaseAdmin } from "./supabase";

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
    // Use admin client to bypass RLS
    const { error } = await supabaseAdmin.from("revenue").insert({
      transaction_id: transactionId,
      fee_ngn: feeNGN,
      fee_in_send: feeInSEND,
    });

    if (error) {
      console.error("[Revenue] ❌ Error recording revenue:", error);
      console.error("[Revenue] Transaction ID:", transactionId, "Fee NGN:", feeNGN, "Fee $SEND:", feeInSEND);
      return { success: false, error: error.message };
    }

    console.log(`[Revenue] ✅ Recorded revenue: ${feeNGN} NGN (${feeInSEND} $SEND) for transaction ${transactionId}`);
    return { success: true };
  } catch (error: any) {
    console.error("[Revenue] ❌ Exception recording revenue:", error);
    console.error("[Revenue] Transaction ID:", transactionId, "Fee NGN:", feeNGN, "Fee $SEND:", feeInSEND);
    return { success: false, error: error.message || "Failed to record revenue" };
  }
}

/**
 * Get total revenue in $SEND
 */
export async function getTotalRevenueInSEND(): Promise<number> {
  try {
    // Use admin client to bypass RLS for admin operations
    const { data, error } = await supabaseAdmin
      .from("revenue")
      .select("fee_in_send");

    if (error) {
      console.error("[Revenue] Error fetching total revenue:", error);
      return 0;
    }

    if (!data || data.length === 0) {
      console.log("[Revenue] No revenue records found");
      return 0;
    }

    const total = data.reduce((sum, record) => {
      const feeValue = parseFloat(record.fee_in_send || "0");
      if (isNaN(feeValue)) {
        console.warn(`[Revenue] Invalid fee_in_send value: ${record.fee_in_send}`);
        return sum;
      }
      return sum + feeValue;
    }, 0);

    console.log(`[Revenue] Total revenue calculated: ${total.toFixed(4)} $SEND from ${data.length} records`);
    return total;
  } catch (error) {
    console.error("[Revenue] Exception fetching total revenue:", error);
    return 0;
  }
}

