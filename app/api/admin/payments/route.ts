import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Fetch all onramp payments from our database (Paystack + Flutterwave + ZainPay).
 * Uses transactions table as source of truth. Reads payment_reference plus metadata for Flutterwave tx_ref and ZainPay account number.
 */
export async function GET(request: NextRequest) {
  try {
    // Select columns that exist: payment_reference (DB column), metadata (migration 025)
    const { data: allTransactions, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("id, transaction_id, user_id, wallet_address, payment_reference, metadata, ngn_amount, send_amount, status, tx_hash, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (txError) {
      console.error("[Admin Payments] Supabase error:", txError);
      throw txError;
    }

    const transactions = allTransactions || [];

    if (transactions.length === 0) {
      return NextResponse.json({ success: true, payments: [] }, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    const userIds = [...new Set((transactions.map((t) => t.user_id).filter(Boolean) as string[]))];
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .in("id", userIds);
    const emailByUserId = (users || []).reduce<Record<string, string>>((acc, u) => {
      if (u?.id && u?.email) acc[u.id] = u.email;
      return acc;
    }, {});

    const flutterwaveMeta = (m: unknown) => (m as { flutterwave_tx_ref?: string } | null)?.flutterwave_tx_ref;
    const zainpayMeta = (m: unknown) => (m as { zainpay_account_number?: string } | null)?.zainpay_account_number;

    const payments = transactions.map((t) => {
      const payRef = (t as { payment_reference?: string | null }).payment_reference;
      const ref = payRef || flutterwaveMeta(t.metadata) || t.transaction_id || "";
      const statusLabel = t.status === "completed" ? "success" : t.status === "pending" ? "pending" : "failed";
      const isFlutterwave = (payRef && String(payRef).startsWith("FLW")) || !!flutterwaveMeta(t.metadata);
      const isZainPay = (payRef && String(payRef).startsWith("ZAINPAY")) || !!zainpayMeta(t.metadata);

      let source = "—";
      if (ref) {
        if (isZainPay) source = "ZainPay";
        else if (isFlutterwave) source = "Flutterwave";
        else source = "Paystack";
      }

      return {
        reference: ref,
        amount: typeof t.ngn_amount === "number" ? t.ngn_amount : parseFloat(String(t.ngn_amount || "0")),
        status: statusLabel,
        customer: (t.user_id && emailByUserId[t.user_id]) || "—",
        createdAt: t.created_at,
        verified: t.status === "completed",
        transactionId: t.transaction_id || null,
        walletAddress: t.wallet_address || null,
        sendAmount: t.send_amount || null,
        txHash: t.tx_hash || null,
        source,
      };
    });

    console.log(`[Admin Payments] Returned ${payments.length} payments from DB (Paystack + Flutterwave + ZainPay)`);

    return NextResponse.json(
      { success: true, payments },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error: any) {
    const details = error?.message ?? String(error);
    console.error("[Admin Payments] Error:", details);
    return NextResponse.json(
      { success: false, error: "Failed to fetch payments", details },
      { status: 500, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
