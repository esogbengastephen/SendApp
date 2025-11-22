import { NextRequest, NextResponse } from "next/server";
import { getExchangeRate } from "@/lib/settings";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    // Get the current exchange rate from settings (can be updated by admin)
    const rate = getExchangeRate();
    
    console.log(`[API Rate] Returning exchange rate: ${rate}`);

    // Set cache headers to prevent caching
    const headers = new Headers();
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    headers.set("X-Rate", rate.toString()); // Add rate in header for debugging

    return NextResponse.json(
      {
        success: true,
        rate,
        currency: "NGN",
        token: "SEND",
        timestamp: new Date().toISOString(),
      },
      { 
        status: 200,
        headers,
      }
    );
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch exchange rate",
        rate: DEFAULT_EXCHANGE_RATE, // Fallback to default
      },
      { status: 500 }
    );
  }
}

