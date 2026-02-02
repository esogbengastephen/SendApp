import { NextRequest, NextResponse } from "next/server";
import { SEND_TOKEN_ADDRESS } from "@/lib/constants";
import { isAdminWallet } from "@/lib/supabase";

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";

function coinGeckoHeaders(): HeadersInit {
  const headers: HeadersInit = { Accept: "application/json" };
  const apiKey = process.env.COINGECKO_API_KEY;
  if (apiKey) {
    (headers as Record<string, string>)["x-cg-demo-api-key"] = apiKey;
  }
  return headers;
}

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

    // Fetch prices from CoinGecko: SEND (Base), USDC, USDT (simple/price)
    const contractAddress = SEND_TOKEN_ADDRESS.toLowerCase();
    const headers = coinGeckoHeaders();

    try {
      // Fetch SEND (Base), USDC, USDT and USD→NGN in parallel
      const [sendResponse, stablecoinsResponse] = await Promise.all([
        fetch(
          `${COINGECKO_API_BASE}/simple/token_price/base?contract_addresses=${contractAddress}&vs_currencies=usd`,
          { headers }
        ),
        fetch(
          `${COINGECKO_API_BASE}/simple/price?ids=usd-coin,tether&vs_currencies=usd,ngn`,
          { headers }
        ),
      ]);

      if (sendResponse.status === 429 || stablecoinsResponse.status === 429) {
        return NextResponse.json({
          success: false,
          error: "CoinGecko rate limit (429). Wait a minute and retry, or set COINGECKO_API_KEY in your environment for higher limits.",
        }, { status: 429 });
      }

      if (!sendResponse.ok) {
        throw new Error(`CoinGecko API error: ${sendResponse.status}`);
      }

      const sendData = await sendResponse.json();
      const tokenData = sendData[contractAddress];

      if (!tokenData || !tokenData.usd) {
        return NextResponse.json({
          success: false,
          error: "Token not found on CoinGecko or price unavailable",
        }, { status: 404 });
      }

      const sendUsd = tokenData.usd;
      let usdToNgnRate = 1500;
      let sendNgn: number | null = sendUsd * usdToNgnRate;

      // Parse USDC/USDT and USD→NGN from stablecoins response
      let usdcUsd: number | null = null;
      let usdcNgn: number | null = null;
      let usdtUsd: number | null = null;
      let usdtNgn: number | null = null;

      if (stablecoinsResponse.ok) {
        const scData = await stablecoinsResponse.json();
        const usdCoin = scData["usd-coin"];
        const tether = scData["tether"];
        if (usdCoin?.ngn != null) usdToNgnRate = usdCoin.ngn;
        sendNgn = sendUsd * usdToNgnRate;
        if (usdCoin?.usd != null) {
          usdcUsd = usdCoin.usd;
          usdcNgn = usdCoin.ngn ?? usdCoin.usd * usdToNgnRate;
        }
        if (tether?.usd != null) {
          usdtUsd = tether.usd;
          usdtNgn = tether.ngn ?? tether.usd * usdToNgnRate;
        }
      }

      return NextResponse.json({
        success: true,
        price: {
          usd: sendUsd,
          ngn: sendNgn,
          contractAddress: SEND_TOKEN_ADDRESS,
          network: "base",
          USDC: usdcUsd != null ? { usd: usdcUsd, ngn: usdcNgn } : null,
          USDT: usdtUsd != null ? { usd: usdtUsd, ngn: usdtNgn } : null,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (coingeckoError: any) {
      console.error("CoinGecko API error:", coingeckoError);
      const message = coingeckoError.message || "Unknown error";
      const is429 = String(message).includes("429");
      return NextResponse.json({
        success: false,
        error: is429
          ? "CoinGecko rate limit (429). Wait a minute and retry, or set COINGECKO_API_KEY in your environment for higher limits."
          : `Failed to fetch price from CoinGecko: ${message}`,
      }, { status: is429 ? 429 : 500 });
    }
  } catch (error: any) {
    console.error("Error fetching CoinGecko price:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

