import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAccountBalance } from "@/lib/flutterwave";
import { getUserFromStorage } from "@/lib/session";

/**
 * Sync Flutterwave balance from API to database
 * Fetches balance from Flutterwave and updates database
 */
export async function POST(request: NextRequest) {
  try {
    // Get current user from session
    const user = getUserFromStorage();
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get Flutterwave account balance
    const balanceResult = await getAccountBalance();

    if (!balanceResult.success) {
      return NextResponse.json(
        { success: false, error: balanceResult.error || "Failed to fetch balance" },
        { status: 500 }
      );
    }

    // Note: Flutterwave's getAccountBalance returns the merchant's main balance
    // For individual user balances, we need to track them separately
    // This API syncs the main account balance, but user balances are tracked per-user in the database

    // Get user's current balance from database
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("flutterwave_balance, flutterwave_virtual_account_number")
      .eq("id", user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Return user's balance from database (which is updated by webhooks)
    return NextResponse.json({
      success: true,
      data: {
        balance: parseFloat(userData.flutterwave_balance?.toString() || "0"),
        accountNumber: userData.flutterwave_virtual_account_number,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[Flutterwave Sync Balance] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
