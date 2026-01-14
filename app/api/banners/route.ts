import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET - Fetch all active banners
 */
export async function GET(request: NextRequest) {
  try {
    const { data: banners, error } = await supabaseAdmin
      .from("banners")
      .select("*")
      .eq("is_active", true)
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
    console.error("Error in GET /api/banners:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new banner (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, image_url, link_url, display_order, is_active } = body;

    if (!image_url) {
      return NextResponse.json(
        { success: false, error: "Image URL is required" },
        { status: 400 }
      );
    }

    const { data: banner, error } = await supabaseAdmin
      .from("banners")
      .insert({
        title: title || null,
        image_url,
        link_url: link_url || null,
        display_order: display_order || 0,
        is_active: is_active !== undefined ? is_active : true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating banner:", error);
      return NextResponse.json(
        { success: false, error: "Failed to create banner" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      banner,
    });
  } catch (error: any) {
    console.error("Error in POST /api/banners:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
