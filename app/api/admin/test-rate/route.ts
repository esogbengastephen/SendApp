import { NextResponse } from "next/server";
import { getExchangeRate, getSettings } from "@/lib/settings";

/**
 * Test endpoint to check current exchange rate
 * This helps debug if the rate is being updated correctly
 */
export async function GET() {
  const rate = getExchangeRate();
  const settings = getSettings();

  return NextResponse.json({
    currentRate: rate,
    settings: {
      exchangeRate: settings.exchangeRate,
      updatedAt: settings.updatedAt.toISOString(),
      updatedBy: settings.updatedBy,
    },
    message: "Current exchange rate from settings module",
  });
}

