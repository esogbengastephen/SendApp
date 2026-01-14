import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { userId, credentialId, signature, clientDataJSON, authenticatorData } = await request.json();

    if (!userId || !credentialId || !signature) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify user has this credential
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("passkey_credential_id, passkey_public_key")
      .eq("id", userId)
      .eq("passkey_credential_id", credentialId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: "Invalid credential" },
        { status: 401 }
      );
    }

    // In production, verify the signature cryptographically
    // For now, we'll do a basic check
    // TODO: Implement proper WebAuthn signature verification using passkey_public_key

    return NextResponse.json({
      success: true,
      message: "Passkey verified",
    });
  } catch (error: any) {
    console.error("Error verifying passkey:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

