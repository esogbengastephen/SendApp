import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateExchangeRate, updateTransactionsEnabled, updateMinimumPurchase } from "@/lib/settings";
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

    const settings = await getSettings();

    return NextResponse.json({
      success: true,
      settings: {
        exchangeRate: settings.exchangeRate,
        transactionsEnabled: settings.transactionsEnabled !== false,
        minimumPurchase: settings.minimumPurchase || 3000,
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
    const { exchangeRate, transactionsEnabled, minimumPurchase, walletAddress } = body;

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

    // Update exchange rate if provided
    if (exchangeRate !== undefined) {
      // Validate exchange rate
      if (isNaN(parseFloat(exchangeRate)) || parseFloat(exchangeRate) <= 0) {
        return NextResponse.json(
          { success: false, error: "Invalid exchange rate. Must be a positive number." },
          { status: 400 }
        );
      }

      const rateValue = parseFloat(exchangeRate);
      console.log(`[Admin Settings] Updating exchange rate to: ${rateValue}`);
      
      await updateExchangeRate(
        rateValue,
        walletAddress.toLowerCase()
      );
    }

    // Update transactions enabled status if provided
    if (transactionsEnabled !== undefined) {
      const enabled = transactionsEnabled === true || transactionsEnabled === "true";
      console.log(`[Admin Settings] Updating transactions enabled to: ${enabled}`);
      
      await updateTransactionsEnabled(
        enabled,
        walletAddress.toLowerCase()
      );
    }

    // Update minimum purchase if provided
    if (minimumPurchase !== undefined) {
      // Validate minimum purchase
      const minPurchaseValue = parseFloat(minimumPurchase);
      if (isNaN(minPurchaseValue) || minPurchaseValue <= 0) {
        return NextResponse.json(
          { success: false, error: "Invalid minimum purchase. Must be a positive number." },
          { status: 400 }
        );
      }

      console.log(`[Admin Settings] Updating minimum purchase to: ${minPurchaseValue}`);
      
      await updateMinimumPurchase(
        minPurchaseValue,
        walletAddress.toLowerCase()
      );
    }

    // Return updated settings
    const updatedSettings = await getSettings();

    return NextResponse.json({
      success: true,
      settings: {
        exchangeRate: updatedSettings.exchangeRate,
        transactionsEnabled: updatedSettings.transactionsEnabled !== false,
        minimumPurchase: updatedSettings.minimumPurchase || 3000,
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

