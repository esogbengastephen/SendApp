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

    // Get user from email (if provided) or create identifier
    let userId: string | null = null;
    let userIdentifier: string | null = null;
    const normalizedEmail = userEmail ? userEmail.toLowerCase().trim() : null;
    
    if (normalizedEmail) {
      const userResult = await getSupabaseUserByEmail(normalizedEmail);
      if (userResult.success && userResult.user) {
        userId = userResult.user.id;
        userIdentifier = userId; // Use user ID as identifier (most stable)
        console.log(`[OffRamp] Found user: ${userResult.user.email} (ID: ${userId})`);
      } else {
        // If user doesn't exist yet, use email as identifier
        // This will be a guest user (user_id = NULL)
        userIdentifier = normalizedEmail;
        console.log(`[OffRamp] User not found in database, using email as identifier: ${normalizedEmail}`);
      }
    } else {
      // For guest users without email, use account number as identifier
      userIdentifier = `guest_${accountNumber.trim()}`;
      console.log(`[OffRamp] Guest user (no email), using account number as identifier`);
    }

    // Check if user already has a wallet address in a previous transaction
    // This ensures we reuse the same wallet for the same user
    let walletAddress: string | null = null;
    if (userIdentifier) {
      // For registered users (user_id exists), check by user_id
      if (userId) {
        const { data: existingTx } = await supabaseAdmin
          .from("offramp_transactions")
          .select("unique_wallet_address")
          .eq("user_id", userId)
          .not("unique_wallet_address", "is", null)
          .limit(1)
          .maybeSingle();

        if (existingTx?.unique_wallet_address) {
          walletAddress = existingTx.unique_wallet_address;
          console.log(`[OffRamp] Found existing wallet for registered user (ID: ${userId}): ${walletAddress}`);
        }
      } 
      // For guest users (user_id is NULL), check by user_email
      else if (normalizedEmail) {
        const { data: existingTx } = await supabaseAdmin
          .from("offramp_transactions")
          .select("unique_wallet_address")
          .eq("user_email", normalizedEmail)
          .is("user_id", null) // Only check guest users
          .not("unique_wallet_address", "is", null)
          .limit(1)
          .maybeSingle();

        if (existingTx?.unique_wallet_address) {
          walletAddress = existingTx.unique_wallet_address;
          console.log(`[OffRamp] Found existing wallet for guest user (email: ${normalizedEmail}): ${walletAddress}`);
        }
      }
    }

    // Generate unique transaction ID
    const transactionId = `offramp_${nanoid(12)}`;

    // Generate or reuse wallet address for this user
    let wallet;
    
    // If user already has a wallet, skip generation and reuse it
    if (walletAddress) {
      console.log(`[OffRamp] Reusing existing wallet ${walletAddress} for user ${userIdentifier}`);
      // Create a minimal wallet object for existing wallets
      wallet = {
        address: walletAddress,
        privateKey: "", // We don't need the private key for existing wallets
        derivationPath: "existing",
      };
    } else {
      // No existing wallet, generate a new one
      try {
        wallet = generateUserOfframpWallet(userIdentifier!);
        walletAddress = wallet.address;
        console.log(`[OffRamp] Generated new wallet address ${wallet.address} for user ${userIdentifier}`);
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
    }

    // Check if there's already a pending transaction for this wallet+account combo
    // The unique index ensures only 1 pending transaction per wallet+account at a time
    const { data: existingPending } = await supabaseAdmin
      .from("offramp_transactions")
      .select("transaction_id, status")
      .eq("unique_wallet_address", walletAddress)
      .eq("user_account_number", accountNumber.trim())
      .in("status", ["pending", "token_received", "swapping"])
      .maybeSingle();

    if (existingPending) {
      console.log(`[OffRamp] ⚠️  Pending transaction already exists for this wallet+account combo: ${existingPending.transaction_id}`);
      // Return the existing transaction instead of creating a new one
      return NextResponse.json({
        success: true,
        transactionId: existingPending.transaction_id,
        uniqueWalletAddress: walletAddress,
        message: "Using existing pending transaction for this wallet and account number",
      });
    }

    // Create off-ramp transaction record in database
    // CRITICAL: Store wallet_identifier for consistent wallet derivation during swap
    // Multiple transactions can share the same wallet address (same user, different account numbers)
    // The unique index ensures only 1 pending transaction per wallet+account combo
    const { data: transaction, error } = await supabaseAdmin
      .from("offramp_transactions")
      .insert({
        transaction_id: transactionId,
        user_id: userId, // NULL for guest users, UUID for registered users
        user_email: normalizedEmail || "guest",
        user_account_number: accountNumber.trim(),
        user_account_name: accountName?.trim() || null,
        user_bank_code: bankCode?.trim() || null,
        wallet_identifier: userIdentifier!, // CRITICAL: Store the exact identifier used
        unique_wallet_address: walletAddress,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("[OffRamp] Error creating transaction:", error);
      console.error("[OffRamp] Error details:", JSON.stringify(error, null, 2));
      
      // Check if it's a unique constraint violation (pending transaction already exists for wallet+account)
      if (error.message?.includes("unique constraint") || error.message?.includes("duplicate key") || error.message?.includes("idx_one_pending_tx_per_wallet_account")) {
        // This means there's already a pending transaction for this wallet+account combo
        // Find the existing pending transaction
        const { data: existingTx } = await supabaseAdmin
          .from("offramp_transactions")
          .select("*")
          .eq("unique_wallet_address", walletAddress)
          .eq("user_account_number", accountNumber.trim())
          .in("status", ["pending", "token_received", "swapping"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (existingTx) {
          console.log(`[OffRamp] ⚠️  Pending transaction already exists: ${existingTx.transaction_id}`);
          return NextResponse.json({
            success: true,
            transactionId: existingTx.transaction_id,
            uniqueWalletAddress: existingTx.unique_wallet_address,
            message: "Pending transaction already exists for this wallet and account number",
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

