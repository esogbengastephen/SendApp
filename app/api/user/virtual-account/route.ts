import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Get virtual account information for a user (EMAIL-BASED)
 * Returns the dedicated bank account number assigned to this user
 * Works for ALL wallets belonging to this user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const walletAddress = searchParams.get("walletAddress");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Missing userId parameter" },
        { status: 400 }
      );
    }

    console.log(`[Get Virtual Account] Request for user ${userId}${walletAddress ? `, wallet ${walletAddress}` : ''}`);

    // Get virtual account from USERS table (EMAIL-BASED, not wallet-based)
    // Use Flutterwave account as primary, fallback to Paystack
    const { data: user, error } = await supabase
      .from("users")
      .select("default_virtual_account_number, default_virtual_account_bank, paystack_customer_code, virtual_account_assigned_at, flutterwave_virtual_account_number, flutterwave_virtual_account_bank, flutterwave_balance")
      .eq("id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No user found - return empty state
        console.log(`[Get Virtual Account] No user found for userId ${userId}`);
        return NextResponse.json({
          success: true,
          data: {
            hasVirtualAccount: false,
            accountNumber: null,
            bankName: null,
          },
        });
      }

      console.error("[Get Virtual Account] Database error:", error);
      return NextResponse.json(
        { success: false, error: "Database error" },
        { status: 500 }
      );
    }

    // Use Flutterwave account as primary, fallback to Paystack
    const accountNumber = user?.flutterwave_virtual_account_number || user?.default_virtual_account_number;
    const bankName = user?.flutterwave_virtual_account_bank || user?.default_virtual_account_bank;
    const hasVirtualAccount = !!accountNumber;

    // If wallet address provided, ensure it's linked to user (for tracking)
    if (walletAddress && hasVirtualAccount) {
      await supabase
        .from("user_wallets")
        .upsert({
          user_id: userId,
          wallet_address: walletAddress.toLowerCase(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,wallet_address"
        });
    }

    console.log(`[Get Virtual Account] ${hasVirtualAccount ? 'Found' : 'No'} virtual account for user ${userId} (Flutterwave primary, Paystack fallback)`);

    return NextResponse.json({
      success: true,
      data: {
        hasVirtualAccount,
        accountNumber,
        bankName,
        customerCode: user?.paystack_customer_code,
        assignedAt: user?.virtual_account_assigned_at,
        balance: user?.flutterwave_balance ? parseFloat(user.flutterwave_balance.toString()) : null,
      },
    });
  } catch (error: any) {
    console.error("[Get Virtual Account] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

