import { NextRequest, NextResponse } from "next/server";
import { SEND_TOKEN_ADDRESS } from "@/lib/constants";
import { isAdminWallet } from "@/lib/supabase";

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";

/**
 * GET - Fetch CoinGecko price for SEND token
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
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

    // Fetch price from CoinGecko using contract address on Base network
    const contractAddress = SEND_TOKEN_ADDRESS.toLowerCase();
    
    try {
      // Try to get price in USD first
      const usdResponse = await fetch(
        `${COINGECKO_API_BASE}/simple/token_price/base?contract_addresses=${contractAddress}&vs_currencies=usd`,
        {
          headers: {
            "Accept": "application/json",
          },
        }
      );

      if (!usdResponse.ok) {
        throw new Error(`CoinGecko API error: ${usdResponse.status}`);
      }

      const usdData = await usdResponse.json();
      const tokenData = usdData[contractAddress];

      if (!tokenData || !tokenData.usd) {
        return NextResponse.json({
          success: false,
          error: "Token not found on CoinGecko or price unavailable",
        }, { status: 404 });
      }

      const usdPrice = tokenData.usd;

      // Fetch USD to NGN conversion rate
      let ngnPrice = null;
      try {
        const ngnResponse = await fetch(
          `${COINGECKO_API_BASE}/simple/price?ids=usd-coin&vs_currencies=ngn`,
          {
            headers: {
              "Accept": "application/json",
            },
          }
        );

        if (ngnResponse.ok) {
          const ngnData = await ngnResponse.json();
          // Use USDC price as reference for USD to NGN
          // Or we can use a fixed rate or another API
          // For now, let's use a common rate (you can update this)
          const usdToNgnRate = ngnData["usd-coin"]?.ngn || 1500; // Fallback to ~1500 NGN per USD
          ngnPrice = usdPrice * usdToNgnRate;
        }
      } catch (ngnError) {
        console.error("Error fetching NGN conversion:", ngnError);
        // Use fallback rate
        const fallbackUsdToNgn = 1500;
        ngnPrice = usdPrice * fallbackUsdToNgn;
      }

      return NextResponse.json({
        success: true,
        price: {
          usd: usdPrice,
          ngn: ngnPrice,
          contractAddress: SEND_TOKEN_ADDRESS,
          network: "base",
          timestamp: new Date().toISOString(),
        },
      });
    } catch (coingeckoError: any) {
      console.error("CoinGecko API error:", coingeckoError);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch price from CoinGecko: ${coingeckoError.message}`,
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Error fetching CoinGecko price:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

