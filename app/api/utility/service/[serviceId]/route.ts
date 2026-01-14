import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET - Fetch utility service settings by service ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> | { serviceId: string } }
) {
  try {
    // Handle both Promise and direct params (Next.js 15+ uses Promise)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { serviceId } = resolvedParams;

    if (!serviceId) {
      return NextResponse.json(
        { success: false, error: "Service ID required" },
        { status: 400 }
      );
    }

    // Fetch service settings
    const { data: service, error } = await supabaseAdmin
      .from("utility_settings")
      .select("*")
      .eq("id", serviceId)
      .single();

    if (error || !service) {
      // Return default settings if not found
      const defaultServices: Record<string, any> = {
        airtime: {
          id: "airtime",
          name: "Airtime",
          status: "active",
          markup: 2.5,
          minAmount: 50,
          maxAmount: 10000,
        },
        data: {
          id: "data",
          name: "Data Bundle",
          status: "active",
          markup: 3.0,
          minAmount: 100,
          maxAmount: 50000,
        },
        tv: {
          id: "tv",
          name: "Cable TV Subscription",
          status: "active",
          markup: 2.0,
          minAmount: 1000,
          maxAmount: 50000,
        },
        betting: {
          id: "betting",
          name: "Betting Wallet Funding",
          status: "active",
          markup: 2.5,
          minAmount: 100,
          maxAmount: 100000,
        },
        "gift-card-redeem": {
          id: "gift-card-redeem",
          name: "Gift Card Redeem",
          status: "active",
          markup: 5.0,
          minAmount: 500,
          maxAmount: 50000,
        },
      };

      const defaultService = defaultServices[serviceId] || {
        id: serviceId,
        status: "disabled",
        markup: 0,
        minAmount: 0,
        maxAmount: 0,
      };

      return NextResponse.json({
        success: true,
        service: defaultService,
      });
    }

    // Fetch network-specific prices if available
    const { data: networkPrices } = await supabaseAdmin
      .from("utility_network_prices")
      .select("*")
      .eq("service_id", serviceId)
      .eq("enabled", true);

    return NextResponse.json({
      success: true,
      service: {
        ...service,
        networkPrices: networkPrices || [],
      },
    });
  } catch (error: any) {
    console.error("Error fetching service settings:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

