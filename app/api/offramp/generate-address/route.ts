import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { generateOfframpWallet } from "@/lib/offramp-wallet";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserByEmail } from "@/lib/supabase-users";

/**
 * Generate unique wallet address for off-ramp transaction
 * POST /api/offramp/generate-address
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountNumber, accountName, bankCode, userEmail } = body;

    // Validate required fields
    if (!accountNumber || !accountNumber.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Account number is required",
        },
        { status: 400 }
      );
    }

    // Validate account number format (10 digits)
    if (!/^\d{10}$/.test(accountNumber.trim())) {
      return NextResponse.json(
        {
          success: false,
          message: "Account number must be 10 digits",
        },
        { status: 400 }
      );
    }

    // Get user from email (if provided)
    let userId: string | null = null;
    if (userEmail) {
      const userResult = await getSupabaseUserByEmail(userEmail);
      if (userResult.success && userResult.user) {
        userId = userResult.user.id;
        console.log(`[OffRamp] Found user: ${userResult.user.email}`);
      }
    }

    // Generate unique transaction ID
    const transactionId = `offramp_${nanoid(12)}`;

    // Generate unique wallet address using HD wallet
    const wallet = generateOfframpWallet(transactionId);

    console.log(`[OffRamp] Generated wallet address ${wallet.address} for transaction ${transactionId}`);

    // Create off-ramp transaction record in database
    const { data: transaction, error } = await supabaseAdmin
      .from("offramp_transactions")
      .insert({
        transaction_id: transactionId,
        user_id: userId,
        user_email: userEmail || "guest",
        user_account_number: accountNumber.trim(),
        user_account_name: accountName?.trim() || null,
        user_bank_code: bankCode?.trim() || null,
        unique_wallet_address: wallet.address,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("[OffRamp] Error creating transaction:", error);
      return NextResponse.json(
        {
          success: false,
          message: "Failed to create transaction. Please try again.",
        },
        { status: 500 }
      );
    }

    console.log(`[OffRamp] ✅ Transaction created: ${transactionId}`);

    return NextResponse.json({
      success: true,
      transactionId,
      uniqueWalletAddress: wallet.address,
      message: "Payment address generated successfully",
    });
  } catch (error) {
    console.error("[OffRamp] Error generating address:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "An error occurred",
      },
      { status: 500 }
    );
  }
}

