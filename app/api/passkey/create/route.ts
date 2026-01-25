import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      credentialId,
      publicKey,
      encryptedSeed, // ENCRYPTED seed phrase only (never plaintext!)
      addresses, // Object with all chain addresses
    } = await request.json();

    if (
      !userId ||
      !credentialId ||
      !publicKey ||
      !encryptedSeed ||
      !addresses
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // SECURITY: Verify that we're only storing encrypted seed, never plaintext
    // The encryptedSeed should be a base64 string, not a plaintext mnemonic
    if (encryptedSeed.split(" ").length === 12) {
      // This looks like a plaintext seed phrase (12 words)
      console.error("[SECURITY] Attempted to store plaintext seed phrase!");
      return NextResponse.json(
        { success: false, error: "Security violation: Plaintext seed phrase detected" },
        { status: 400 }
      );
    }

    // Validate that addresses is an object
    if (typeof addresses !== "object" || Array.isArray(addresses)) {
      return NextResponse.json(
        { success: false, error: "Addresses must be an object" },
        { status: 400 }
      );
    }

    // Check if user has existing wallet before overwriting
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("wallet_addresses, wallet_seed_encrypted, wallet_created_at")
      .eq("id", userId)
      .single();

    const existingAddresses = (existingUser?.wallet_addresses as Record<string, string>) || {};
    const hasExistingWallet = !!(existingUser?.wallet_seed_encrypted && Object.keys(existingAddresses).length > 0);
    const originalWalletCreatedAt = existingUser?.wallet_created_at;

    // IMPORTANT: If user has existing wallet, we preserve the addresses
    // However, the seed phrase cannot be preserved because it's encrypted with the old passkey
    // This means the user will lose access to the old wallet's private keys
    // But we preserve the addresses for reference/display purposes
    const finalAddresses = hasExistingWallet 
      ? { ...existingAddresses, ...addresses } // Merge: preserve old addresses, add new ones
      : addresses;

    // Log warning if overwriting existing wallet
    if (hasExistingWallet) {
      console.warn(`[Passkey Create] ⚠️ User ${userId} has existing wallet. Old seed will be lost, but addresses preserved.`);
    }

    // Update user with passkey and wallet info
    // Only storing encrypted seed, never plaintext
    const { error } = await supabaseAdmin
      .from("users")
      .update({
        passkey_credential_id: credentialId,
        passkey_public_key: publicKey,
        wallet_seed_encrypted: encryptedSeed, // New encrypted seed (old one cannot be decrypted without old passkey)
        wallet_addresses: finalAddresses, // Preserved addresses merged with new ones
        wallet_created_at: originalWalletCreatedAt || new Date().toISOString(), // Preserve original creation date if exists
        passkey_created_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      console.error("Error creating passkey:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: hasExistingWallet 
        ? "New passkey created. Note: You now have a new wallet. Old wallet addresses are preserved for reference, but the old seed phrase cannot be recovered."
        : "Passkey and multi-chain wallet created successfully",
      addresses: finalAddresses,
      hadExistingWallet: hasExistingWallet,
      preservedAddressCount: hasExistingWallet ? Object.keys(existingAddresses).length : 0,
    });
  } catch (error: any) {
    console.error("Error creating passkey:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

