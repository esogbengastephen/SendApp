import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserFromStorage } from "@/lib/session";

/**
 * Check payment status and account information
 * Helps diagnose why balance isn't updating
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromStorage();
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's Flutterwave account info
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select(
        "id, email, flutterwave_virtual_account_number, flutterwave_virtual_account_bank, flutterwave_balance, flutterwave_balance_updated_at, mobile_number"
      )
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Get recent transactions for this account
    const { data: transactions } = await supabaseAdmin
      .from("transactions")
      .select("transaction_id, ngn_amount, status, completed_at, metadata, paystack_reference")
      .eq("user_id", user.id)
      .or("metadata->>type.eq.ngn_deposit,metadata->>type.eq.ngn_transfer")
      .order("completed_at", { ascending: false })
      .limit(10);

    // Check if account number matches
    const accountNumber = userData.flutterwave_virtual_account_number;
    const balance = parseFloat(userData.flutterwave_balance?.toString() || "0");
    const lastUpdated = userData.flutterwave_balance_updated_at;

    // Get webhook URL (for configuration reference)
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://your-domain.com"}/api/flutterwave/webhook`;

    return NextResponse.json({
      success: true,
      data: {
        account: {
          accountNumber: accountNumber || "Not set",
          bankName: userData.flutterwave_virtual_account_bank || "Not set",
          mobileNumber: userData.mobile_number || "Not set",
        },
        balance: {
          current: balance,
          lastUpdated: lastUpdated || "Never",
          formatted: `₦${balance.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        },
        recentTransactions: transactions || [],
        webhook: {
          url: webhookUrl,
          configured: "Check Flutterwave Dashboard → Settings → Webhooks",
          events: ["virtualaccountpayment", "transfer.completed", "transfer.failed"],
        },
        diagnostics: {
          hasAccountNumber: !!accountNumber,
          hasBalance: balance > 0,
          hasTransactions: (transactions?.length || 0) > 0,
          recommendations: [
            !accountNumber && "Account number not set. Add phone number in Settings.",
            !lastUpdated && "Balance never updated. Check webhook configuration.",
            balance === 0 && transactions?.length === 0 && "No transactions found. Payment may not have been processed yet.",
            balance === 0 && transactions?.length > 0 && "Transactions exist but balance is 0. Check webhook processing.",
          ].filter(Boolean),
        },
      },
    });
  } catch (error: any) {
    console.error("[Flutterwave Check Payment] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
