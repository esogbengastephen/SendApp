import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isAdminWallet } from "@/lib/supabase";

/**
 * GET - Fetch utility service settings
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminWallet = searchParams.get("adminWallet");

    if (!adminWallet) {
      return NextResponse.json(
        { success: false, error: "Admin wallet address required" },
        { status: 400 }
      );
    }

    const isAdmin = await isAdminWallet(adminWallet);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    // Fetch utility settings from database
    const { data: settings, error } = await supabaseAdmin
      .from("utility_settings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching utility settings:", error);
      // Return default settings if table doesn't exist yet
      return NextResponse.json({
        success: true,
        services: [],
        networkPrices: {},
      });
    }

    // Transform data
    const services = settings || [];
    const networkPrices: Record<string, any[]> = {};

    // Fetch network-specific prices
    const { data: networkPriceData } = await supabaseAdmin
      .from("utility_network_prices")
      .select("*");

    if (networkPriceData) {
      networkPriceData.forEach((np: any) => {
        if (!networkPrices[np.service_id]) {
          networkPrices[np.service_id] = [];
        }
        networkPrices[np.service_id].push({
          network: np.network,
          markup: np.markup,
          enabled: np.enabled,
        });
      });
    }

    return NextResponse.json({
      success: true,
      services,
      networkPrices,
    });
  } catch (error: any) {
    console.error("Error fetching utility settings:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update utility service settings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminWallet, serviceId, service, networkPrices } = body;

    if (!adminWallet || !serviceId) {
      return NextResponse.json(
        { success: false, error: "Admin wallet and service ID required" },
        { status: 400 }
      );
    }

    const isAdmin = await isAdminWallet(adminWallet);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    // Update or insert service settings
    const { error: serviceError } = await supabaseAdmin
      .from("utility_settings")
      .upsert({
        id: serviceId,
        ...service,
        updated_at: new Date().toISOString(),
        updated_by: adminWallet.toLowerCase(),
      }, {
        onConflict: "id",
      });

    if (serviceError) {
      console.error("Error saving service settings:", serviceError);
      return NextResponse.json(
        { success: false, error: "Failed to save service settings" },
        { status: 500 }
      );
    }

    // Update network prices
    if (networkPrices && Array.isArray(networkPrices)) {
      // Delete existing network prices for this service
      await supabaseAdmin
        .from("utility_network_prices")
        .delete()
        .eq("service_id", serviceId);

      // Insert new network prices
      if (networkPrices.length > 0) {
        const networkPriceRecords = networkPrices.map((np: any) => ({
          service_id: serviceId,
          network: np.network,
          markup: np.markup,
          enabled: np.enabled,
          updated_at: new Date().toISOString(),
          updated_by: adminWallet.toLowerCase(),
        }));

        const { error: networkError } = await supabaseAdmin
          .from("utility_network_prices")
          .insert(networkPriceRecords);

        if (networkError) {
          console.error("Error saving network prices:", networkError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Utility settings saved successfully",
    });
  } catch (error: any) {
    console.error("Error updating utility settings:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

