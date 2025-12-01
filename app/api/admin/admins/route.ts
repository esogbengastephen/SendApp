import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin, supabaseAdmin } from "@/lib/supabase";

/**
 * GET - List all admins (super admin only)
 */
export async function GET(request: NextRequest) {
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

    // Fetch all admins from database
    const { data: admins, error } = await supabaseAdmin
      .from("admin_wallets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching admins:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch admins" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      admins: admins || [],
    });
  } catch (error: any) {
    console.error("Error in GET /api/admin/admins:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST - Add new admin (super admin only)
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { adminWalletAddress, role, permissions, notes } = body;

    // Validate input
    if (!adminWalletAddress) {
      return NextResponse.json(
        { success: false, error: "Admin wallet address is required" },
        { status: 400 }
      );
    }

    const normalizedAddress = adminWalletAddress.toLowerCase().trim();

    // Validate wallet address format (basic check)
    if (!normalizedAddress.startsWith("0x") || normalizedAddress.length !== 42) {
      return NextResponse.json(
        { success: false, error: "Invalid wallet address format" },
        { status: 400 }
      );
    }

    // Validate role
    if (role && !["super_admin", "admin"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "Invalid role. Must be 'super_admin' or 'admin'" },
        { status: 400 }
      );
    }

    // Validate permissions (must be array of strings)
    if (permissions && (!Array.isArray(permissions) || !permissions.every(p => typeof p === "string"))) {
      return NextResponse.json(
        { success: false, error: "Permissions must be an array of strings" },
        { status: 400 }
      );
    }

    // Check if admin already exists
    const { data: existingAdmin } = await supabaseAdmin
      .from("admin_wallets")
      .select("id")
      .eq("wallet_address", normalizedAddress)
      .maybeSingle();

    if (existingAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin wallet already exists" },
        { status: 400 }
      );
    }

    // Insert new admin
    const { data: newAdmin, error: insertError } = await supabaseAdmin
      .from("admin_wallets")
      .insert({
        wallet_address: normalizedAddress,
        role: role || "admin",
        permissions: permissions || [],
        created_by: walletAddress.toLowerCase(),
        notes: notes || null,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating admin:", insertError);
      return NextResponse.json(
        { success: false, error: "Failed to create admin" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      admin: newAdmin,
      message: "Admin created successfully",
    });
  } catch (error: any) {
    console.error("Error in POST /api/admin/admins:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

