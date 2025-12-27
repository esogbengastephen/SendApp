import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminWallet } from "@/lib/supabase";
import { getOfframpExchangeRate, calculateOfframpFee } from "@/lib/offramp-settings";

/**
 * Get all off-ramp transactions (Admin only)
 * GET /api/admin/offramp
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const adminWallet = searchParams.get("adminWallet");
    const status = searchParams.get("status");

    // Verify admin access
    if (!adminWallet) {
      return NextResponse.json(
        { success: false, error: "Admin wallet address required" },
        { status: 400 }
      );
    }

    const isAdmin = await isAdminWallet(adminWallet);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    // Build query
    let query = supabaseAdmin
      .from("offramp_transactions")
      .select("*")
      .order("created_at", { ascending: false });

    // Filter by status if provided
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error("[Admin OffRamp] Error fetching transactions:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    // Calculate NGN amount for transactions that have USDC but no NGN amount yet
    const exchangeRate = await getOfframpExchangeRate();
    const enrichedTransactions = await Promise.all(
      (transactions || []).map(async (tx) => {
        // If NGN amount is already set, use it
        if (tx.ngn_amount != null && tx.ngn_amount > 0) {
          return tx;
        }

        // If USDC amount is available, calculate NGN amount
        if (tx.usdc_amount && parseFloat(tx.usdc_amount) > 0) {
          try {
            const usdcAmount = parseFloat(tx.usdc_amount);
            const ngnAmountBeforeFees = Math.round((usdcAmount * exchangeRate) * 100) / 100;
            const feeNGN = await calculateOfframpFee(ngnAmountBeforeFees);
            const finalNGNAmount = Math.round((ngnAmountBeforeFees - feeNGN) * 100) / 100;

            return {
              ...tx,
              ngn_amount: finalNGNAmount > 0 ? finalNGNAmount : null,
              // Also set exchange_rate and fee_ngn if not already set
              exchange_rate: tx.exchange_rate || exchangeRate,
              fee_ngn: tx.fee_ngn || feeNGN,
            };
          } catch (calcError) {
            console.error(`[Admin OffRamp] Error calculating NGN for tx ${tx.transaction_id}:`, calcError);
            return tx;
          }
        }

        return tx;
      })
    );

    return NextResponse.json({
      success: true,
      transactions: enrichedTransactions,
    });
  } catch (error: any) {
    console.error("[Admin OffRamp] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

