import { NextRequest, NextResponse } from "next/server";
import { getExchangeRate, getSettings } from "@/lib/settings";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants";

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // Get the current exchange rate from settings (can be updated by admin)
    // Import fresh to avoid module caching issues
    const settings = getSettings();
    const rate = settings.exchangeRate;
    
    console.log(`[API Rate] Current settings:`, settings);
    console.log(`[API Rate] Returning exchange rate: ${rate}`);

    // Set cache headers to prevent caching
    const headers = new Headers();
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    headers.set("X-Rate", rate.toString()); // Add rate in header for debugging
    headers.set("X-Timestamp", new Date().toISOString());

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

