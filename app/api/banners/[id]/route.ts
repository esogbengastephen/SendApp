import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * PUT - Update a banner (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both Promise and direct params (Next.js 15+ uses Promise)
    const resolvedParams = params instanceof Promise ? await params : params;
    const bannerId = resolvedParams.id;
    const body = await request.json();
    const { title, image_url, link_url, display_order, is_active } = body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (image_url !== undefined) updateData.image_url = image_url;
    if (link_url !== undefined) updateData.link_url = link_url;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: banner, error } = await supabaseAdmin
      .from("banners")
      .update(updateData)
      .eq("id", bannerId)
      .select()
      .single();

    if (error) {
      console.error("Error updating banner:", error);
      return NextResponse.json(
        { success: false, error: "Failed to update banner" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      banner,
    });
  } catch (error: any) {
    console.error("Error in PUT /api/banners/[id]:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a banner (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both Promise and direct params (Next.js 15+ uses Promise)
    const resolvedParams = params instanceof Promise ? await params : params;
    const bannerId = resolvedParams.id;

    const { error } = await supabaseAdmin
      .from("banners")
      .delete()
      .eq("id", bannerId);

    if (error) {
      console.error("Error deleting banner:", error);
      return NextResponse.json(
        { success: false, error: "Failed to delete banner" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (error: any) {
    console.error("Error in DELETE /api/banners/[id]:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
