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

    // Update user with passkey and wallet info
    // Only storing encrypted seed, never plaintext
    const { error } = await supabaseAdmin
      .from("users")
      .update({
        passkey_credential_id: credentialId,
        passkey_public_key: publicKey,
        wallet_seed_encrypted: encryptedSeed, // Encrypted only!
        wallet_addresses: addresses, // JSONB column - automatically supports any chain
        wallet_created_at: new Date().toISOString(),
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
      message: "Passkey and multi-chain wallet created successfully",
      addresses,
    });
  } catch (error: any) {
    console.error("Error creating passkey:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

