import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { nanoid } from "nanoid";
import { getOrCreateSmartWallet, encryptWalletPrivateKey, normalizeSmartWalletAddress } from "@/lib/coinbase-smart-wallet";
import { generateSolanaWalletForUser, encryptSolanaPrivateKey } from "@/lib/solana-wallet";
import { getOfframpTransactionsEnabled } from "@/lib/settings";

export async function POST(request: NextRequest) {
  try {
    const offrampEnabled = await getOfframpTransactionsEnabled();
    if (!offrampEnabled) {
      return NextResponse.json(
        { success: false, error: "Sell (offramp) transactions are currently disabled. Please check back later." },
        { status: 403 }
      );
    }

    const {
      accountNumber,
      accountName,
      bankCode,
      bankName,
      userEmail,
      network = "base",
    } = await request.json();

    if (!accountNumber || accountNumber.length !== 10) {
      return NextResponse.json(
        { success: false, error: "Invalid account number. Must be 10 digits." },
        { status: 400 }
      );
    }

    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: "User email required" },
        { status: 400 }
      );
    }

    if (network !== "base" && network !== "solana") {
      return NextResponse.json(
        { success: false, error: "Invalid network. Use 'base' or 'solana'" },
        { status: 400 }
      );
    }

    // Get user ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", userEmail)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const userId = userData.id;

    // Get or create wallet for user (direct function call instead of HTTP request)
    // Note: BASE and SEND use the same smart wallet (both on Base network)
    let walletAddress: string;

    if (network === "base") {
      // Check if user already has smart wallet (for BASE or SEND - they share the same wallet)
      const { data: existingWallet, error: fetchError } = await supabaseAdmin
        .from("users")
        .select("smart_wallet_address, smart_wallet_owner_encrypted")
        .eq("id", userId)
        .single();

      if (existingWallet?.smart_wallet_address) {
        // Reuse existing smart wallet address (normalize in case DB has WalletAddress object string)
        walletAddress = normalizeSmartWalletAddress(existingWallet.smart_wallet_address) ?? existingWallet.smart_wallet_address;
      } else {
        // Generate smart wallet
        const walletData = await getOrCreateSmartWallet(
          userId,
          userEmail,
          existingWallet?.smart_wallet_owner_encrypted,
          existingWallet?.smart_wallet_address
        );

        // Encrypt private key before storing
        const encryptedKey = await encryptWalletPrivateKey(
          walletData.ownerPrivateKey,
          userId
        );

        // Store in database
        const { error: updateError } = await supabaseAdmin
          .from("users")
          .update({
            smart_wallet_address: walletData.address,
            smart_wallet_owner_encrypted: encryptedKey,
            smart_wallet_salt: walletData.salt,
            smart_wallet_created_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (updateError) {
          console.error("[Off-ramp] Failed to save smart wallet:", updateError);
          return NextResponse.json(
            { success: false, error: "Failed to save smart wallet" },
            { status: 500 }
          );
        }

        walletAddress = walletData.address;
      }
    } else {
      // Solana wallet
      const { data: existingWallet, error: fetchError } = await supabaseAdmin
        .from("users")
        .select("solana_wallet_address, solana_wallet_private_key_encrypted")
        .eq("id", userId)
        .single();

      if (existingWallet?.solana_wallet_address) {
        walletAddress = existingWallet.solana_wallet_address;
      } else {
        // Generate Solana wallet
        const walletData = generateSolanaWalletForUser(userId);

        // Encrypt private key
        const encryptedKey = await encryptSolanaPrivateKey(
          walletData.privateKey,
          userId
        );

        // Store in database
        const { error: updateError } = await supabaseAdmin
          .from("users")
          .update({
            solana_wallet_address: walletData.address,
            solana_wallet_private_key_encrypted: encryptedKey,
            solana_wallet_created_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (updateError) {
          console.error("[Off-ramp] Failed to save Solana wallet:", updateError);
          return NextResponse.json(
            { success: false, error: "Failed to save Solana wallet" },
            { status: 500 }
          );
        }

        walletAddress = walletData.address;
      }
    }

    // Ensure walletAddress is properly formatted (extract 0x from WalletAddress{...} if needed)
    const cleanWalletAddress = normalizeSmartWalletAddress(walletAddress) ?? walletAddress;
    
    // Validate wallet address format based on network
    if (network === "base") {
      // Base network addresses should be 0x-prefixed and 42 characters
      if (!cleanWalletAddress || !cleanWalletAddress.startsWith("0x") || cleanWalletAddress.length !== 42) {
        console.error("[Off-ramp] Invalid Base wallet address format:", cleanWalletAddress);
        return NextResponse.json(
          { success: false, error: `Invalid wallet address format: ${cleanWalletAddress?.substring(0, 50)}` },
          { status: 500 }
        );
      }
    } else if (network === "solana") {
      // Solana addresses are base58 encoded, typically 32-44 characters, no 0x prefix
      // Valid base58 characters: 1-9, A-H, J-N, P-Z, a-k, m-z (excluding 0, O, I, l)
      const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
      if (!cleanWalletAddress || !base58Regex.test(cleanWalletAddress)) {
        console.error("[Off-ramp] Invalid Solana wallet address format:", cleanWalletAddress);
        return NextResponse.json(
          { success: false, error: `Invalid Solana wallet address format: ${cleanWalletAddress?.substring(0, 50)}` },
          { status: 500 }
        );
      }
    }

    // Generate transaction ID (ensure uniqueness)
    // Users can create multiple transactions, so we just need to ensure transaction_id is unique
    let transactionId = nanoid();
    let attempts = 0;
    const maxAttempts = 10;

    // Check if transaction_id already exists and regenerate if needed
    // Note: Users can create multiple transactions, we just need unique transaction_id
    while (attempts < maxAttempts) {
      const { data: existing, error: checkError } = await supabaseAdmin
        .from("offramp_transactions")
        .select("transaction_id")
        .eq("transaction_id", transactionId)
        .maybeSingle(); // Use maybeSingle to avoid errors if not found
      
      // If no error and no existing record, transaction ID is unique
      if (!checkError && !existing) {
        break; // Transaction ID is unique
      }
      
      // If there was an error (not just "not found"), log it but continue
      if (checkError && checkError.code !== "PGRST116") { // PGRST116 is "not found"
        console.warn("[Off-ramp] Error checking transaction ID:", checkError);
      }
      
      transactionId = nanoid(); // Generate new ID
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      // Fallback: append timestamp to ensure uniqueness
      transactionId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      console.warn("[Off-ramp] Used fallback transaction ID generation");
    }

    // Create off-ramp transaction record
    // Note: Table has both old columns (user_account_number, unique_wallet_address, wallet_identifier) 
    // and new columns (account_number, wallet_address, network, etc.)
    // We populate both to ensure compatibility
    const { data: transactionData, error: transactionError } = await supabaseAdmin
      .from("offramp_transactions")
      .insert({
        transaction_id: transactionId,
        user_id: userId,
        user_email: userEmail,
        // Old required columns
        user_account_number: accountNumber,
        user_account_name: accountName || null,
        user_bank_code: bankCode || null,
        wallet_identifier: String(userId), // Ensure it's a string
        unique_wallet_address: cleanWalletAddress,
        // New columns (from migration)
        wallet_address: cleanWalletAddress,
        smart_wallet_address: network === "base" ? cleanWalletAddress : null,
        solana_wallet_address: network === "solana" ? cleanWalletAddress : null,
        account_number: accountNumber,
        account_name: accountName || null,
        bank_code: bankCode || null,
        bank_name: bankName || null,
        network,
        status: "pending",
      })
      .select()
      .single();

    if (transactionError) {
      console.error("[Off-ramp] Database error:", transactionError);
      console.error("[Off-ramp] Error code:", transactionError.code);
      console.error("[Off-ramp] Error details:", transactionError.details);
      console.error("[Off-ramp] Error hint:", transactionError.hint);
      console.error("[Off-ramp] Transaction data attempted:", {
        transaction_id: transactionId,
        user_id: userId,
        wallet_address: cleanWalletAddress?.substring(0, 20) + "...",
        account_number: accountNumber,
        wallet_identifier: String(userId),
      });
      
      // Provide more specific error message
      let errorMessage = "Failed to create transaction";
      if (transactionError.code === "23505") { // Unique violation
        // This usually means transaction_id collision (very rare with nanoid)
        // Try generating a new transaction ID and retry once
        console.log("[Off-ramp] Retrying with new transaction ID due to conflict...");
        const retryTransactionId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // Retry the insert once
        const { data: retryData, error: retryError } = await supabaseAdmin
          .from("offramp_transactions")
          .insert({
            transaction_id: retryTransactionId,
            user_id: userId,
            user_email: userEmail,
            user_account_number: accountNumber,
            user_account_name: accountName || null,
            user_bank_code: bankCode || null,
            wallet_identifier: String(userId),
            unique_wallet_address: cleanWalletAddress,
            wallet_address: cleanWalletAddress,
            smart_wallet_address: network === "base" ? cleanWalletAddress : null,
            solana_wallet_address: network === "solana" ? cleanWalletAddress : null,
            account_number: accountNumber,
            account_name: accountName || null,
            bank_code: bankCode || null,
            bank_name: bankName || null,
            network,
            status: "pending",
          })
          .select()
          .single();
        
        if (!retryError && retryData) {
          // Retry succeeded
          return NextResponse.json({
            success: true,
            transactionId: retryTransactionId,
            walletAddress: cleanWalletAddress,
            network,
            message: `Send ${network === "base" ? "Base/SEND tokens" : "Solana tokens"} to this address`,
          });
        }
        
        errorMessage = "Unable to create transaction. Please try again in a moment.";
      } else if (transactionError.code === "23502") { // Not null violation
        errorMessage = "Missing required information. Please check your input.";
      } else if (transactionError.message) {
        errorMessage = transactionError.message;
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage,
          details: process.env.NODE_ENV === "development" ? {
            code: transactionError.code,
            message: transactionError.message,
            details: transactionError.details,
            hint: transactionError.hint,
          } : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transactionId,
      walletAddress: cleanWalletAddress, // Return clean address
      network,
      message: `Send ${network === "base" ? "Base/SEND tokens" : "Solana tokens"} to this address`,
    });
  } catch (error: any) {
    console.error("[Off-ramp] Error:", error);
    console.error("[Off-ramp] Error stack:", error.stack);
    console.error("[Off-ramp] Error details:", {
      message: error.message,
      name: error.name,
      code: error.code,
    });
    
    // Provide more detailed error message
    let errorMessage = error.message || "Internal server error";
    
    // Check for specific error types
    if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
      errorMessage = "Authentication failed. Please check your Coinbase API credentials.";
    } else if (error.message?.includes("Wallet") || error.message?.includes("wallet")) {
      errorMessage = `Wallet creation failed: ${error.message}`;
    } else if (error.message?.includes("address")) {
      errorMessage = `Address extraction failed: ${error.message}`;
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
