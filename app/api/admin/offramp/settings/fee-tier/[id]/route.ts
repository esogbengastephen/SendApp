import { NextRequest, NextResponse } from "next/server";
import { isAdminWallet } from "@/lib/supabase";
import { deleteOfframpFeeTier } from "@/lib/offramp-settings";

/**
 * DELETE /api/admin/offramp/settings/fee-tier/[id]
 * Delete a fee tier
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminWallet = request.nextUrl.searchParams.get("adminWallet");

    if (!adminWallet) {
      return NextResponse.json(
        { success: false, message: "Admin wallet address required" },
        { status: 400 }
      );
    }

    const isAdmin = await isAdminWallet(adminWallet);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }

    const { id: tierId } = await params;
    if (!tierId) {
      return NextResponse.json(
        { success: false, message: "Fee tier ID required" },
        { status: 400 }
      );
    }

    await deleteOfframpFeeTier(tierId);

    return NextResponse.json({
      success: true,
      message: "Fee tier deleted successfully",
    });
  } catch (error: any) {
    console.error("[Admin Offramp Settings] DELETE fee-tier error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to delete fee tier",
      },
      { status: 500 }
    );
  }
}
