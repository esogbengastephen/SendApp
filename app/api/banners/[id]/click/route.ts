import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST - Track banner click
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both Promise and direct params (Next.js 15+ uses Promise)
    const resolvedParams = params instanceof Promise ? await params : params;
    const bannerId = resolvedParams.id;

    // Increment click count
    const { error } = await supabaseAdmin.rpc("increment_banner_clicks", {
      banner_id: bannerId,
    });

    // If RPC doesn't exist, use update query
    if (error) {
      const { data: banner } = await supabaseAdmin
        .from("banners")
        .select("click_count")
        .eq("id", bannerId)
        .single();

      await supabaseAdmin
        .from("banners")
        .update({ click_count: (banner?.click_count || 0) + 1 })
        .eq("id", bannerId);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("Error tracking banner click:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
