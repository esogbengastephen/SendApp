import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/offramp/pending?userEmail=...
 * Returns the user's pending off-ramp transaction (deposit_address, transactionId, etc.).
 * Used to refresh the address when it has been updated (e.g. after regeneration).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get("userEmail")?.trim();
    if (!userEmail) {
      return NextResponse.json({ success: false, error: "userEmail required" }, { status: 400 });
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", userEmail)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const { data: row, error } = await supabaseAdmin
      .from("offramp_transactions")
      .select("transaction_id, deposit_address, account_name, user_account_name, network, status")
      .eq("user_id", userData.id)
      .eq("status", "pending")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: "Failed to fetch" }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ success: true, hasPending: false });
    }

    return NextResponse.json({
      success: true,
      hasPending: true,
      depositAddress: row.deposit_address,
      transactionId: row.transaction_id,
      accountName: row.account_name ?? row.user_account_name ?? "",
      network: row.network ?? "base",
    });
  } catch (err) {
    console.error("[Offramp pending] Error:", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
