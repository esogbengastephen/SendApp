import { NextResponse } from "next/server";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants";

export async function GET() {
  try {
    // TODO: Fetch real-time rate from DEX or price oracle
    // For now, return the default rate from environment or constants
    const rate = DEFAULT_EXCHANGE_RATE;

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

