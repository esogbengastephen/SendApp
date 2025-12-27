import { NextRequest, NextResponse } from "next/server";
import { isAdminWallet } from "@/lib/supabase";
import {
  getOfframpSettings,
  updateOfframpSettings,
  getOfframpFeeTiers,
  updateOfframpFeeTier,
  deleteOfframpFeeTier,
  type OfframpSettings,
  type OfframpFeeTier,
} from "@/lib/offramp-settings";

/**
 * GET /api/admin/offramp/settings
 * Get current off-ramp settings (exchange rate, limits, fee tiers)
 */
export async function GET(request: NextRequest) {
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

    // Get settings and fee tiers
    const [settings, feeTiers] = await Promise.all([
      getOfframpSettings(),
      getOfframpFeeTiers(),
    ]);

    return NextResponse.json({
      success: true,
      settings,
      feeTiers,
    });
  } catch (error: any) {
    console.error("[Admin Offramp Settings] GET error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to fetch off-ramp settings",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/offramp/settings
 * Update off-ramp settings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminWallet, settings } = body;

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

    if (!settings) {
      return NextResponse.json(
        { success: false, message: "Settings object required" },
        { status: 400 }
      );
    }

    // Update settings
    const updatedSettings = await updateOfframpSettings(settings, adminWallet);

    return NextResponse.json({
      success: true,
      message: "Off-ramp settings updated successfully",
      settings: updatedSettings,
    });
  } catch (error: any) {
    console.error("[Admin Offramp Settings] PUT error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to update off-ramp settings",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/offramp/settings/fee-tier
 * Create or update a fee tier
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminWallet, feeTier } = body;

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

    if (!feeTier) {
      return NextResponse.json(
        { success: false, message: "Fee tier object required" },
        { status: 400 }
      );
    }

    // Update or create fee tier
    const updatedTier = await updateOfframpFeeTier(feeTier, adminWallet);

    return NextResponse.json({
      success: true,
      message: "Fee tier updated successfully",
      feeTier: updatedTier,
    });
  } catch (error: any) {
    console.error("[Admin Offramp Settings] POST fee-tier error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to update fee tier",
      },
      { status: 500 }
    );
  }
}
