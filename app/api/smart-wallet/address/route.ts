import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const network = searchParams.get("network") || "base";

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Missing userId" },
        { status: 400 }
      );
    }

    const fieldName = network === "solana" 
      ? "solana_wallet_address" 
      : "smart_wallet_address";

    const { data, error } = await supabaseAdmin
      .from("users")
      .select(fieldName)
      .eq("id", userId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      walletAddress: (data as any)[fieldName] || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
