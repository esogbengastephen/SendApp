import { NextRequest, NextResponse } from "next/server";
import { getAdminDetails, isAdminWallet } from "@/lib/supabase";

/**
 * GET - Return current admin's role and permissions (for sidebar and access control)
 * Authorization: Bearer <walletAddress>
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const walletAddress = authHeader.replace("Bearer ", "").trim();
    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const isAdmin = await isAdminWallet(walletAddress);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const details = await getAdminDetails(walletAddress);
    return NextResponse.json({
      success: true,
      role: details.role ?? "admin",
      permissions: details.permissions ?? [],
    });
  } catch (error) {
    console.error("Error in GET /api/admin/me:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
