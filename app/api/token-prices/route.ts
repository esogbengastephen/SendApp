import { NextRequest, NextResponse } from "next/server";
import { SEND_TOKEN_ADDRESS } from "@/lib/constants";
import { supabaseAdmin } from "@/lib/supabase";
import { getSettings } from "@/lib/settings";

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";

/**
 * GET - Fetch prices for SEND, USDC, and USDT tokens
 * SEND: Admin dashboard exchange rate (1 SEND = 1/exchangeRate NGN) takes priority.
 * USDC/USDT: Database (buy prices) > CoinGecko API
 */
export async function GET(request: NextRequest) {
  try {
    const contractAddress = SEND_TOKEN_ADDRESS.toLowerCase();
    
    // Initialize price objects
    const prices: {
      SEND: number | null;
      USDC: number | null;
      USDT: number | null;
    } = {
      SEND: null,
      USDC: null,
      USDT: null,
    };

    const pricesNGN: {
      SEND: number | null;
      USDC: number | null;
      USDT: number | null;
    } = {
      SEND: null,
      USDC: null,
      USDT: null,
    };

    // Step 0: Use admin dashboard rates (buy: exchangeRate; sell: sendToNgnSell, usdcSellPriceNgn, usdtSellPriceNgn)
    const pricesNGNSell: { SEND: number | null; USDC: number | null; USDT: number | null } = {
      SEND: null,
      USDC: null,
      USDT: null,
    };
    try {
      const settings = await getSettings();
      const ngnToSend = settings.exchangeRate;
      if (ngnToSend && ngnToSend > 0) {
        pricesNGN.SEND = 1 / ngnToSend;
        prices.SEND = pricesNGN.SEND / 1500; // Approximate USD for compatibility
      }
      // Sell rates (offramp) – different from buy after admin publishes
      if (settings.sendToNgnSell != null && settings.sendToNgnSell > 0) {
        pricesNGNSell.SEND = settings.sendToNgnSell;
      }
      if (settings.usdcSellPriceNgn != null && settings.usdcSellPriceNgn > 0) {
        pricesNGNSell.USDC = settings.usdcSellPriceNgn;
      }
      if (settings.usdtSellPriceNgn != null && settings.usdtSellPriceNgn > 0) {
        pricesNGNSell.USDT = settings.usdtSellPriceNgn;
      }
    } catch (settingsError) {
      console.warn("Token prices: could not load admin exchange rate, will use DB/CoinGecko for SEND:", settingsError);
    }

    // Step 1: Try to fetch prices from database first (for USDC, USDT; SEND already set from admin)
    try {
      const { data: dbPrices, error: dbError } = await supabaseAdmin
        .from("token_buy_prices")
        .select("token_symbol, buy_price_ngn");

      if (!dbError && dbPrices && dbPrices.length > 0) {
        // Use database prices (these are buy prices in NGN). Don't overwrite SEND if already set from admin.
        for (const price of dbPrices) {
          const symbol = price.token_symbol as keyof typeof pricesNGN;
          if (symbol === "SEND" && pricesNGN.SEND != null) {
            // Keep admin dashboard rate for SEND
          } else if (symbol in pricesNGN) {
            pricesNGN[symbol] = parseFloat(price.buy_price_ngn.toString());
            const usdPrice = parseFloat(price.buy_price_ngn.toString()) / 1500;
            prices[symbol] = usdPrice;
          }
        }
      }
    } catch (dbError) {
      console.error("Error fetching prices from database:", dbError);
      // Fall through to CoinGecko for missing prices
    }

    // Step 2: Fetch missing prices from CoinGecko API
    const tokensNeedingPrice: string[] = [];
    if (!pricesNGN.SEND) tokensNeedingPrice.push("SEND");
    if (!pricesNGN.USDC) tokensNeedingPrice.push("USDC");
    if (!pricesNGN.USDT) tokensNeedingPrice.push("USDT");

    if (tokensNeedingPrice.length > 0) {
      // Fetch all prices in parallel (including USD to NGN rate)
      const [sendPriceResponse, usdcPriceResponse, usdtPriceResponse, usdToNgnResponse] = await Promise.all([
        // SEND token price (using contract address on Base)
        tokensNeedingPrice.includes("SEND")
          ? fetch(
              `${COINGECKO_API_BASE}/simple/token_price/base?contract_addresses=${contractAddress}&vs_currencies=usd`,
              {
                headers: {
                  "Accept": "application/json",
                },
              }
            )
          : Promise.resolve(new Response(null, { status: 200 })),
        // USDC price
        tokensNeedingPrice.includes("USDC")
          ? fetch(
              `${COINGECKO_API_BASE}/simple/price?ids=usd-coin&vs_currencies=usd`,
              {
                headers: {
                  "Accept": "application/json",
                },
              }
            )
          : Promise.resolve(new Response(null, { status: 200 })),
        // USDT price
        tokensNeedingPrice.includes("USDT")
          ? fetch(
              `${COINGECKO_API_BASE}/simple/price?ids=tether&vs_currencies=usd`,
              {
                headers: {
                  "Accept": "application/json",
                },
              }
            )
          : Promise.resolve(new Response(null, { status: 200 })),
        // USD to NGN conversion rate
        fetch(
          `${COINGECKO_API_BASE}/simple/price?ids=usd-coin&vs_currencies=ngn`,
          {
            headers: {
              "Accept": "application/json",
            },
          }
        ),
      ]);

      // Get USD to NGN conversion rate
      let usdToNgnRate = 1500; // Fallback rate
      if (usdToNgnResponse.ok) {
        try {
          const ngnData = await usdToNgnResponse.json();
          if (ngnData["usd-coin"] && ngnData["usd-coin"].ngn) {
            usdToNgnRate = ngnData["usd-coin"].ngn;
          }
        } catch (error) {
          console.error("Error parsing USD to NGN rate:", error);
        }
      }

      // Parse SEND price (only if not already set from database)
      if (!pricesNGN.SEND && sendPriceResponse.ok) {
        try {
          const sendData = await sendPriceResponse.json();
          const tokenData = sendData[contractAddress];
          if (tokenData && tokenData.usd) {
            prices.SEND = tokenData.usd;
            pricesNGN.SEND = tokenData.usd * usdToNgnRate;
          }
        } catch (error) {
          console.error("Error parsing SEND price:", error);
        }
      }

      // Parse USDC price (only if not already set from database)
      if (!pricesNGN.USDC && usdcPriceResponse.ok) {
        try {
          const usdcData = await usdcPriceResponse.json();
          if (usdcData["usd-coin"] && usdcData["usd-coin"].usd) {
            prices.USDC = usdcData["usd-coin"].usd;
            pricesNGN.USDC = usdcData["usd-coin"].usd * usdToNgnRate;
          }
        } catch (error) {
          console.error("Error parsing USDC price:", error);
        }
      }

      // Parse USDT price (only if not already set from database)
      if (!pricesNGN.USDT && usdtPriceResponse.ok) {
        try {
          const usdtData = await usdtPriceResponse.json();
          if (usdtData["tether"] && usdtData["tether"].usd) {
            prices.USDT = usdtData["tether"].usd;
            pricesNGN.USDT = usdtData["tether"].usd * usdToNgnRate;
          }
        } catch (error) {
          console.error("Error parsing USDT price:", error);
        }
      }
    }

    const response = NextResponse.json({
      success: true,
      prices,
      pricesNGN,
      pricesNGNSell: pricesNGNSell.SEND != null || pricesNGNSell.USDC != null || pricesNGNSell.USDT != null ? pricesNGNSell : undefined,
      usdToNgnRate: 1500, // Default rate
      timestamp: new Date().toISOString(),
      source: pricesNGN.SEND || pricesNGN.USDC || pricesNGN.USDT ? "database" : "coingecko",
    });

    // Cache token prices for 60 seconds (prices update frequently but not every second)
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    
    return response;
  } catch (error: any) {
    console.error("Error fetching token prices:", error);
    
    // Try to return database prices even on error
    try {
      const { data: dbPrices } = await supabaseAdmin
        .from("token_buy_prices")
        .select("token_symbol, buy_price_ngn");

      if (dbPrices && dbPrices.length > 0) {
        const fallbackPricesNGN: {
          SEND: number | null;
          USDC: number | null;
          USDT: number | null;
        } = {
          SEND: null,
          USDC: null,
          USDT: null,
        };

        dbPrices.forEach((price) => {
          const symbol = price.token_symbol as keyof typeof fallbackPricesNGN;
          if (symbol in fallbackPricesNGN) {
            fallbackPricesNGN[symbol] = parseFloat(price.buy_price_ngn.toString());
          }
        });

        return NextResponse.json({
          success: true,
          prices: {
            SEND: fallbackPricesNGN.SEND ? fallbackPricesNGN.SEND / 1500 : null,
            USDC: fallbackPricesNGN.USDC ? fallbackPricesNGN.USDC / 1500 : null,
            USDT: fallbackPricesNGN.USDT ? fallbackPricesNGN.USDT / 1500 : null,
          },
          pricesNGN: fallbackPricesNGN,
          pricesNGNSell: undefined,
          usdToNgnRate: 1500,
          timestamp: new Date().toISOString(),
          source: "database",
        });
      }
    } catch (fallbackError) {
      console.error("Error fetching fallback prices:", fallbackError);
    }

    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch token prices",
        prices: {
          SEND: null,
          USDC: null,
          USDT: null,
        },
        pricesNGN: {
          SEND: null,
          USDC: null,
          USDT: null,
        }
      },
      { status: 500 }
    );
  }
}

