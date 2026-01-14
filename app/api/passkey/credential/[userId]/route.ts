import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> | { userId: string } }
) {
  try {
    // Handle both Promise and direct params (Next.js 15+ uses Promise)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { userId } = resolvedParams;
    
    console.log("[Credential API] Fetching credential for userId:", userId);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("passkey_credential_id")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("[Credential API] Database error:", error);
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, error: error.message || "Database error" },
        { status: 500 }
      );
    }

    if (!data) {
      console.error("[Credential API] No data returned for userId:", userId);
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    if (!data.passkey_credential_id) {
      console.log("[Credential API] No passkey found for userId:", userId);
      return NextResponse.json(
        { success: false, error: "No passkey found for this user" },
        { status: 404 }
      );
    }

    console.log("[Credential API] Found credential for userId:", userId);
    return NextResponse.json({
      success: true,
      credentialId: data.passkey_credential_id,
    });
  } catch (error: any) {
    console.error("Error getting credential:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

