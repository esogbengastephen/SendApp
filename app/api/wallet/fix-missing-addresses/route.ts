import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateWalletFromSeed } from "@/lib/wallet";

/**
 * Fix missing wallet addresses for existing users
 * This endpoint regenerates all addresses and merges them with existing ones
 * Requires: userId, seedPhrase (decrypted client-side after passkey auth)
 * 
 * SECURITY: Seed phrase should be decrypted client-side and only sent for this operation
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, seedPhrase, addresses: clientGeneratedAddresses } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Missing required field: userId" },
        { status: 400 }
      );
    }

    console.log(`[Fix Addresses] Starting for user: ${userId}`);

    let walletData: { addresses: Record<string, string> };
    
    // Option 1: Use client-generated addresses (preferred - more reliable)
    if (clientGeneratedAddresses && typeof clientGeneratedAddresses === "object") {
      console.log("[Fix Addresses] Using client-generated addresses:", Object.keys(clientGeneratedAddresses));
      walletData = { addresses: clientGeneratedAddresses };
    } 
    // Option 2: Generate server-side (fallback if client doesn't send addresses)
    else if (seedPhrase) {
      // SECURITY: Verify this looks like a valid seed phrase (12 or 24 words)
      const words = seedPhrase.trim().split(/\s+/);
      if (words.length !== 12 && words.length !== 24) {
        return NextResponse.json(
          { success: false, error: "Invalid seed phrase format" },
          { status: 400 }
        );
      }

      console.log("[Fix Addresses] Generating addresses server-side...");
      try {
        walletData = generateWalletFromSeed(seedPhrase);
        console.log("[Fix Addresses] Generated addresses:", Object.keys(walletData.addresses));
        console.log("[Fix Addresses] Address details:", walletData.addresses);
        
        // Validate we got addresses for all expected chains
        const expectedChains = ["bitcoin", "ethereum", "base", "polygon", "monad", "solana", "sui"];
        const missingChains = expectedChains.filter(chain => !walletData.addresses[chain]);
        if (missingChains.length > 0) {
          console.warn("[Fix Addresses] Missing addresses for chains:", missingChains);
        }
      } catch (error: any) {
        console.error("[Fix Addresses] Error generating wallet:", error);
        return NextResponse.json(
          { 
            success: false, 
            error: `Failed to generate wallet addresses: ${error.message}`,
            details: process.env.NODE_ENV === "development" ? error.stack : undefined
          },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Missing required fields: either 'addresses' or 'seedPhrase' must be provided" },
        { status: 400 }
      );
    }

    // Get current addresses from database
    const { data: userData, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("wallet_addresses")
      .eq("id", userId)
      .single();

    if (fetchError || !userData) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const existingAddresses = (userData.wallet_addresses as Record<string, string>) || {};
    console.log("[Fix Addresses] Existing addresses:", Object.keys(existingAddresses));

    // Merge: new addresses override old ones, but keep any custom addresses
    const mergedAddresses = {
      ...existingAddresses,
      ...walletData.addresses, // New addresses override/complete old ones
    };

    console.log("[Fix Addresses] Merged addresses:", Object.keys(mergedAddresses));

    // Update database
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        wallet_addresses: mergedAddresses,
      })
      .eq("id", userId)
      .select("wallet_addresses")
      .single();

    if (updateError) {
      console.error("[Fix Addresses] Update error:", updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    // Verify the update worked
    const verifiedAddresses = updatedUser?.wallet_addresses as Record<string, string> || {};
    console.log("[Fix Addresses] Verified saved addresses:", Object.keys(verifiedAddresses));

    const addedChains = Object.keys(walletData.addresses).filter(k => !existingAddresses[k]);
    
    return NextResponse.json({
      success: true,
      message: "Wallet addresses fixed successfully",
      addresses: verifiedAddresses,
      added: addedChains,
      totalChains: Object.keys(verifiedAddresses).length,
    });
  } catch (error: any) {
    console.error("[Fix Addresses] Error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Internal server error",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

