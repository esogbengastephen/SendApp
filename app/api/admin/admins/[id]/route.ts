import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin, supabaseAdmin } from "@/lib/supabase";

/**
 * PUT - Update admin permissions (super admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify super admin access
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const walletAddress = authHeader.replace("Bearer ", "");
    const isSuper = await isSuperAdmin(walletAddress);

    if (!isSuper) {
      return NextResponse.json(
        { success: false, error: "Super admin access required" },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { role, permissions, notes, is_active } = body;

    // Validate role if provided
    if (role && !["super_admin", "admin"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "Invalid role. Must be 'super_admin' or 'admin'" },
        { status: 400 }
      );
    }

    // Validate permissions if provided
    if (permissions && (!Array.isArray(permissions) || !permissions.every(p => typeof p === "string"))) {
      return NextResponse.json(
        { success: false, error: "Permissions must be an array of strings" },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (permissions !== undefined) updateData.permissions = permissions;
    if (notes !== undefined) updateData.notes = notes;
    if (is_active !== undefined) updateData.is_active = is_active;
    updateData.updated_at = new Date().toISOString();

    // Update admin
    const { data: updatedAdmin, error: updateError } = await supabaseAdmin
      .from("admin_wallets")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating admin:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update admin" },
        { status: 500 }
      );
    }

    if (!updatedAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      admin: updatedAdmin,
      message: "Admin updated successfully",
    });
  } catch (error: any) {
    console.error("Error in PUT /api/admin/admins/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove/deactivate admin (super admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify super admin access
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const walletAddress = authHeader.replace("Bearer ", "");
    const isSuper = await isSuperAdmin(walletAddress);

    if (!isSuper) {
      return NextResponse.json(
        { success: false, error: "Super admin access required" },
        { status: 403 }
      );
    }

    const { id } = params;

    // Check if trying to delete self
    const { data: currentAdmin } = await supabaseAdmin
      .from("admin_wallets")
      .select("wallet_address")
      .eq("id", id)
      .single();

    if (currentAdmin && currentAdmin.wallet_address.toLowerCase() === walletAddress.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "Cannot delete your own admin account" },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active to false
    const { data: deletedAdmin, error: deleteError } = await supabaseAdmin
      .from("admin_wallets")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (deleteError) {
      console.error("Error deleting admin:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to delete admin" },
        { status: 500 }
      );
    }

    if (!deletedAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Admin deactivated successfully",
    });
  } catch (error: any) {
    console.error("Error in DELETE /api/admin/admins/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

