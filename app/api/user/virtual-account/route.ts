import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Get virtual account information for a user's wallet
 * Returns the dedicated bank account number assigned to this user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const walletAddress = searchParams.get("walletAddress");

    if (!userId || !walletAddress) {
      return NextResponse.json(
        { success: false, error: "Missing userId or walletAddress parameters" },
        { status: 400 }
      );
    }

    console.log(`[Get Virtual Account] Request for user ${userId}, wallet ${walletAddress}`);

    // Get virtual account for this user+wallet combination
    const { data, error } = await supabase
      .from("user_wallets")
      .select("*")
      .eq("user_id", userId)
      .eq("wallet_address", walletAddress.toLowerCase())
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No wallet found - return empty state
        console.log(`[Get Virtual Account] No wallet found for user ${userId}`);
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

    const hasVirtualAccount = !!data.virtual_account_number;

    console.log(`[Get Virtual Account] ${hasVirtualAccount ? 'Found' : 'No'} virtual account for user ${userId}`);

    return NextResponse.json({
      success: true,
      data: {
        hasVirtualAccount,
        accountNumber: data.virtual_account_number,
        bankName: data.virtual_account_bank_name,
        bank: data.virtual_account_bank,
        customerCode: data.paystack_customer_code,
        assignedAt: data.virtual_account_assigned_at,
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

