import { NextRequest, NextResponse } from "next/server";
import { getExchangeRate, getSettings } from "@/lib/settings";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants";

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // Get the current exchange rate from settings (always loads from Supabase if cache expired)
    // This ensures the persisted rate is used, not a default
    const settings = await getSettings();
    const rate = settings.exchangeRate;
    
    console.log(`[API Rate] Current settings:`, settings);
    console.log(`[API Rate] Returning exchange rate: ${rate} (loaded from Supabase)`);

    // Set cache headers to prevent caching and ensure fresh data
    const headers = new Headers();
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    headers.set("X-Rate", rate.toString()); // Add rate in header for debugging
    headers.set("X-Timestamp", new Date().toISOString());
    headers.set("Last-Modified", new Date().toUTCString());

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
  } catch (error: any) {
    console.error("[API Rate] Error fetching exchange rate:", error);
    // Try one more time to load from Supabase before falling back
    try {
      const settings = await getSettings();
      console.log(`[API Rate] Retry successful, returning rate: ${settings.exchangeRate}`);
      return NextResponse.json(
        {
          success: true,
          rate: settings.exchangeRate,
          currency: "NGN",
          token: "SEND",
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      );
    } catch (retryError) {
      console.error("[API Rate] Retry also failed, using fallback:", retryError);
      // Only use default as absolute last resort
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch exchange rate from database",
          rate: DEFAULT_EXCHANGE_RATE, // Fallback only if Supabase is completely unavailable
          warning: "Using default rate - database unavailable",
        },
        { status: 500 }
      );
    }
  }
}

