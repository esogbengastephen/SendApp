import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateExchangeRate } from "@/lib/settings";
import { isAdminWallet } from "@/lib/supabase";

/**
 * GET - Get current platform settings
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Extract wallet address from header (set by client)
    const walletAddress = authHeader.replace("Bearer ", "");
    const isAdmin = await isAdminWallet(walletAddress);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const settings = getSettings();

    return NextResponse.json({
      success: true,
      settings: {
        exchangeRate: settings.exchangeRate,
        updatedAt: settings.updatedAt.toISOString(),
        updatedBy: settings.updatedBy,
      },
    });
  } catch (error: any) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update platform settings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { exchangeRate, walletAddress } = body;

    // Verify admin access
    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: "Wallet address required" },
        { status: 400 }
      );
    }

    const isAdmin = await isAdminWallet(walletAddress);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    // Validate exchange rate
    if (!exchangeRate || isNaN(parseFloat(exchangeRate)) || parseFloat(exchangeRate) <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid exchange rate. Must be a positive number." },
        { status: 400 }
      );
    }

    // Update exchange rate
    const rateValue = parseFloat(exchangeRate);
    console.log(`[Admin Settings] Updating exchange rate to: ${rateValue}`);
    
    const updatedSettings = updateExchangeRate(
      rateValue,
      walletAddress.toLowerCase()
    );

    console.log(`[Admin Settings] Exchange rate updated successfully: ${updatedSettings.exchangeRate}`);

    return NextResponse.json({
      success: true,
      settings: {
        exchangeRate: updatedSettings.exchangeRate,
        updatedAt: updatedSettings.updatedAt.toISOString(),
        updatedBy: updatedSettings.updatedBy,
      },
      message: "Settings updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

