import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET - Fetch all banners (admin only - includes inactive)
 */
export async function GET(request: NextRequest) {
  try {
    const { data: banners, error } = await supabaseAdmin
      .from("banners")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching banners:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch banners" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      banners: banners || [],
    });
  } catch (error: any) {
    console.error("Error in GET /api/admin/banners:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
