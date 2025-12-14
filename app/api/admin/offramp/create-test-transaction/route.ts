import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminWallet } from "@/lib/supabase";
import { nanoid } from "nanoid";

/**
 * Create a test transaction for a specific wallet address (Admin only)
 * POST /api/admin/offramp/create-test-transaction
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminWallet, walletAddress, accountNumber, accountName, bankCode, userEmail } = body;

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

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: "Wallet address is required" },
        { status: 400 }
      );
    }

    // Check if transaction already exists
    const { data: existing } = await supabaseAdmin
      .from("offramp_transactions")
      .select("*")
      .eq("unique_wallet_address", walletAddress.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        message: "Transaction already exists for this wallet",
        transaction: existing,
      });
    }

    // Create new transaction
    const transactionId = `offramp_test_${nanoid(8)}`;
    
    const { data: transaction, error } = await supabaseAdmin
      .from("offramp_transactions")
      .insert({
        transaction_id: transactionId,
        user_id: null,
        user_email: userEmail || "test@example.com",
        user_account_number: accountNumber || "1234567890",
        user_account_name: accountName || "Test User",
        user_bank_code: bankCode || "058",
        unique_wallet_address: walletAddress.toLowerCase(),
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("[Create Test Transaction] Error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create transaction",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Test transaction created successfully",
      transaction: transaction,
    });
  } catch (error: any) {
    console.error("[Create Test Transaction] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

