import { NextRequest, NextResponse } from "next/server";
import { fetchBanksFromFlutterwave, NIGERIAN_BANKS } from "@/lib/nigerian-banks";

/**
 * GET - Fetch list of Nigerian banks from Flutterwave API
 * Returns comprehensive list including all fintech providers
 */
export async function GET(request: NextRequest) {
  try {
    // Try to fetch from Flutterwave API for most up-to-date list
    const banks = await fetchBanksFromFlutterwave();
    
    return NextResponse.json({
      success: true,
      data: {
        banks,
        total: banks.length,
        source: "flutterwave_api",
      },
    });
  } catch (error: any) {
    console.error("[Flutterwave Banks] Error:", error);
    
    // Return static list as fallback
    return NextResponse.json({
      success: true,
      data: {
        banks: NIGERIAN_BANKS,
        total: NIGERIAN_BANKS.length,
        source: "static_list",
        note: "Using static list - Flutterwave API unavailable",
      },
    });
  }
}
