import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptSeedPhrase } from "@/lib/wallet";
import { generateWalletFromSeed } from "@/lib/wallet";

/**
 * Regenerate missing wallet addresses for a user
 * Requires passkey authentication (user must provide encrypted seed and public key)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, encryptedSeed, passkeyPublicKey } = await request.json();

    if (!userId || !encryptedSeed || !passkeyPublicKey) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Decrypt seed phrase client-side (this should be done on client, but for now we'll do it here)
    // TODO: Move decryption to client-side for better security
    const seedPhrase = await decryptSeedPhrase(encryptedSeed, passkeyPublicKey);

    // Regenerate all wallet addresses
    const walletData = generateWalletFromSeed(seedPhrase);

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

    // Merge new addresses with existing ones (preserve any custom addresses)
    const existingAddresses = (userData.wallet_addresses as Record<string, string>) || {};
    const mergedAddresses = {
      ...existingAddresses,
      ...walletData.addresses, // New addresses override old ones
    };

    // Update database with complete addresses
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        wallet_addresses: mergedAddresses,
        wallet_created_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating addresses:", updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Wallet addresses regenerated successfully",
      addresses: mergedAddresses,
    });
  } catch (error: any) {
    console.error("Error regenerating addresses:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

