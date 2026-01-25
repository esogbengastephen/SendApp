import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    // Get userId from query parameters (sent from client)
    const userId = request.nextUrl.searchParams.get("userId");
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    // Check if user has passkey
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, passkey_credential_id, wallet_addresses, wallet_seed_encrypted")
      .eq("id", userId)
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const hasPasskey = !!data.passkey_credential_id;
    const walletAddresses = (data.wallet_addresses as Record<string, string>) || {};
    const hasWallet = !!data.wallet_seed_encrypted && Object.keys(walletAddresses).length > 0;

    return NextResponse.json({
      success: true,
      hasPasskey,
      hasWallet,
      needsPasskeySetup: !hasPasskey,
      addressCount: Object.keys(walletAddresses).length,
      walletAddresses: hasWallet ? walletAddresses : null,
    });
  } catch (error: any) {
    console.error("Error checking passkey:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

