import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Get most recent active transaction for a user
 * GET /api/offramp/get-user-transaction?userEmail=...&userId=...
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userEmail = searchParams.get("userEmail");
    const userId = searchParams.get("userId");

    if (!userEmail && !userId) {
      return NextResponse.json(
        {
          success: false,
          message: "userEmail or userId is required",
        },
        { status: 400 }
      );
    }

    // Only load truly active transactions (not completed/failed)
    // Also filter out transactions older than 24 hours that are still pending
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    let query = supabaseAdmin
      .from("offramp_transactions")
      .select("*")
      .in("status", ["pending", "token_received", "swapping", "usdc_received", "paying"])
      .gte("created_at", oneDayAgo.toISOString()) // Only transactions from last 24 hours
      .order("created_at", { ascending: false })
      .limit(1);

    if (userId) {
      query = query.eq("user_id", userId);
    } else if (userEmail) {
      query = query.eq("user_email", userEmail.toLowerCase().trim());
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error("[Get User Transaction] Error:", error);
      return NextResponse.json(
        {
          success: false,
          message: "Failed to fetch transaction",
        },
        { status: 500 }
      );
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({
        success: true,
        transaction: null,
        message: "No active transaction found",
      });
    }

    const transaction = transactions[0];
    
    // Validate transaction: if status is usdc_received or paying but no token was actually detected, reset to pending
    if ((transaction.status === "usdc_received" || transaction.status === "paying") && !transaction.token_address) {
      // This is a stale transaction, don't return it
      return NextResponse.json({
        success: true,
        transaction: null,
        message: "No active transaction found",
      });
    }

    return NextResponse.json({
      success: true,
      transaction: transaction,
    });
  } catch (error) {
    console.error("[Get User Transaction] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "An error occurred",
      },
      { status: 500 }
    );
  }
}

