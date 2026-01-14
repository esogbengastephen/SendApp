import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Get user dashboard data
 * Returns: balance, virtual account, recent transactions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Missing userId parameter" },
        { status: 400 }
      );
    }

    // Get user data with virtual account AND wallet addresses
    // Use Flutterwave account for NGN wallet (primary), keep Paystack for backward compatibility
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, default_virtual_account_number, default_virtual_account_bank, flutterwave_virtual_account_number, flutterwave_virtual_account_bank, flutterwave_balance, mobile_number, wallet_addresses, created_at")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Get user's wallets
    const { data: wallets } = await supabase
      .from("user_wallets")
      .select("wallet_address")
      .eq("user_id", userId);

    // Get user's transactions (completed only)
    const { data: transactions } = await supabase
      .from("transactions")
      .select("id, ngn_amount, send_amount, status, created_at, tx_hash")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(10);

    // Calculate total NGN spent (from transactions)
    const totalSpentNGN = transactions?.reduce(
      (sum, t) => sum + parseFloat(t.ngn_amount || "0"),
      0
    ) || 0;

    // Calculate total SEND received (from transactions)
    const totalReceivedSEND = transactions?.reduce(
      (sum, t) => sum + parseFloat(t.send_amount || "0"),
      0
    ) || 0;

    // Get wallet addresses (from new wallet system)
    const walletAddresses = (user.wallet_addresses as Record<string, string>) || {};

    // Use Flutterwave account for NGN wallet (primary)
    const ngnAccountNumber = user.flutterwave_virtual_account_number || user.default_virtual_account_number;
    const ngnBankName = user.flutterwave_virtual_account_bank || user.default_virtual_account_bank || "Wema Bank";
    const ngnBalance = parseFloat(user.flutterwave_balance?.toString() || "0");

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          email: user.email,
          accountNumber: ngnAccountNumber, // Flutterwave account (primary)
          bankName: ngnBankName,
          mobileNumber: user.mobile_number, // Phone number for display
          displayAccountNumber: user.mobile_number ? user.mobile_number.substring(1) : null, // Phone without leading 0
        },
        balance: {
          ngn: ngnBalance, // Flutterwave balance (from database, synced via webhooks)
          crypto: totalReceivedSEND, // Will be updated with real balances from wallet API
        },
        walletAddresses, // Add wallet addresses
        transactions: transactions?.map(t => ({
          id: t.id,
          amount: parseFloat(t.ngn_amount || "0"),
          sendAmount: parseFloat(t.send_amount || "0"),
          date: t.created_at,
          txHash: t.tx_hash,
        })) || [],
        walletCount: wallets?.length || 0,
      },
    });

    // Add caching headers for better performance (30 seconds cache)
    response.headers.set('Cache-Control', 'private, s-maxage=30, stale-while-revalidate=60');
    
    return response;
  } catch (error: any) {
    console.error("[Dashboard API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
