import { NextResponse } from "next/server";
import { getExchangeRate } from "@/lib/settings";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants";

export async function GET() {
  try {
    // Get the current exchange rate from settings (can be updated by admin)
    const rate = getExchangeRate();

    return NextResponse.json(
      {
        success: true,
        rate,
        currency: "NGN",
        token: "SEND",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
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

