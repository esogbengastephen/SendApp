import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { userId, passkeyVerified } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    // Verify passkey was authenticated (should be done client-side first)
    if (!passkeyVerified) {
      return NextResponse.json(
        { success: false, error: "Passkey authentication required" },
        { status: 401 }
      );
    }

    // Get user's encrypted seed and public key
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("wallet_seed_encrypted, passkey_public_key")
      .eq("id", userId)
      .single();

    if (error || !data || !data.wallet_seed_encrypted) {
      return NextResponse.json(
        { success: false, error: "Wallet not found" },
        { status: 404 }
      );
    }

    // Decryption happens client-side for security
    // We just return the encrypted seed and public key
    return NextResponse.json({
      success: true,
      encryptedSeed: data.wallet_seed_encrypted,
      publicKey: data.passkey_public_key,
    });
  } catch (error: any) {
    console.error("Error getting seed phrase:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

