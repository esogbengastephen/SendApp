import { NextRequest, NextResponse } from "next/server";
import { SEND_TOKEN_ADDRESS } from "@/lib/constants";
import { fetchCoinGeckoPrice } from "@/lib/coingecko";
import { isAdminWallet } from "@/lib/supabase";

/**
 * GET - Fetch CoinGecko price for SEND token
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const walletAddress = authHeader.replace("Bearer ", "");
    const isAdmin = await isAdminWallet(walletAddress);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const price = await fetchCoinGeckoPrice();
    return NextResponse.json({
      success: true,
      price: {
        ...price,
        contractAddress: SEND_TOKEN_ADDRESS,
        network: "base",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (coingeckoError: unknown) {
    console.error("CoinGecko API error:", coingeckoError);
    const message = coingeckoError instanceof Error ? coingeckoError.message : "Unknown error";
    const is429 = String(message).includes("429");
    return NextResponse.json(
      {
        success: false,
        error: is429
          ? "CoinGecko rate limit (429). Wait a minute and retry, or set COINGECKO_API_KEY in your environment for higher limits."
          : `Failed to fetch price from CoinGecko: ${message}`,
      },
      { status: is429 ? 429 : 500 }
    );
  }
}

