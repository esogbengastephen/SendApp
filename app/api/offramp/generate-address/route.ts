import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { generateUserOfframpWallet } from "@/lib/offramp-wallet";
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
    let userIdentifier: string | null = null;
    
    if (userEmail) {
      const userResult = await getSupabaseUserByEmail(userEmail);
      if (userResult.success && userResult.user) {
        userId = userResult.user.id;
        userIdentifier = userId; // Use user ID as identifier (most stable)
        console.log(`[OffRamp] Found user: ${userResult.user.email} (ID: ${userId})`);
      } else {
        // If user doesn't exist yet, use email as identifier
        userIdentifier = userEmail.toLowerCase();
        console.log(`[OffRamp] User not found, using email as identifier: ${userEmail}`);
      }
    } else {
      // For guest users, use account number as identifier
      userIdentifier = `guest_${accountNumber.trim()}`;
      console.log(`[OffRamp] Guest user, using account number as identifier`);
    }

    // Check if user already has a wallet address in a previous transaction
    let walletAddress: string | null = null;
    if (userIdentifier && userEmail) {
      const { data: existingTx } = await supabaseAdmin
        .from("offramp_transactions")
        .select("unique_wallet_address")
        .eq("user_email", userEmail.toLowerCase())
        .not("unique_wallet_address", "is", null)
        .limit(1)
        .single();

      if (existingTx?.unique_wallet_address) {
        walletAddress = existingTx.unique_wallet_address;
        console.log(`[OffRamp] Found existing wallet for user: ${walletAddress}`);
      }
    }

    // Generate unique transaction ID
    const transactionId = `offramp_${nanoid(12)}`;

    // Generate or reuse wallet address for this user
    let wallet;
    try {
      // Always generate the wallet to get the private key
      // This ensures we can monitor transactions on this wallet
      wallet = generateUserOfframpWallet(userIdentifier!);
      
      // If we found an existing wallet, verify it matches
      if (walletAddress && wallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
        console.warn(`[OffRamp] Wallet mismatch! Generated: ${wallet.address}, Existing: ${walletAddress}`);
        console.warn(`[OffRamp] This should not happen. Using generated wallet.`);
        walletAddress = wallet.address;
      } else if (!walletAddress) {
        // No existing wallet, use the generated one
        walletAddress = wallet.address;
        console.log(`[OffRamp] Generated new wallet address ${wallet.address} for user ${userIdentifier}`);
      } else {
        // Existing wallet matches generated one - perfect!
        console.log(`[OffRamp] Reusing existing wallet ${walletAddress} for user ${userIdentifier}`);
        // Use the existing address to ensure consistency
        wallet.address = walletAddress;
      }
    } catch (walletError) {
      console.error("[OffRamp] Error generating wallet:", walletError);
      return NextResponse.json(
        {
          success: false,
          message: walletError instanceof Error ? walletError.message : "Failed to generate wallet address. Please check server configuration.",
        },
        { status: 500 }
      );
    }

    // Create off-ramp transaction record in database
    // Note: Multiple transactions can now share the same wallet address
    const { data: transaction, error } = await supabaseAdmin
      .from("offramp_transactions")
      .insert({
        transaction_id: transactionId,
        user_id: userId,
        user_email: userEmail || "guest",
        user_account_number: accountNumber.trim(),
        user_account_name: accountName?.trim() || null,
        user_bank_code: bankCode?.trim() || null,
        unique_wallet_address: walletAddress,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("[OffRamp] Error creating transaction:", error);
      console.error("[OffRamp] Error details:", JSON.stringify(error, null, 2));
      
      // Check if it's a duplicate key error (shouldn't happen after migration, but handle gracefully)
      if (error.message?.includes("unique constraint") || error.message?.includes("duplicate key")) {
        // If wallet address already exists, try to find existing pending transaction
        const { data: existingTx } = await supabaseAdmin
          .from("offramp_transactions")
          .select("*")
          .eq("unique_wallet_address", walletAddress)
          .eq("user_email", userEmail || "guest")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        
        if (existingTx) {
          console.log(`[OffRamp] Found existing pending transaction, returning it`);
          return NextResponse.json({
            success: true,
            transactionId: existingTx.transaction_id,
            uniqueWalletAddress: existingTx.unique_wallet_address,
            message: "Using existing pending transaction for this wallet",
          });
        }
      }
      
      return NextResponse.json(
        {
          success: false,
          message: error.message || "Failed to create transaction. Please try again.",
          error: process.env.NODE_ENV === "development" ? error : undefined,
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
    console.error("[OffRamp] Error stack:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "An error occurred",
        error: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.stack : String(error)) : undefined,
      },
      { status: 500 }
    );
  }
}

