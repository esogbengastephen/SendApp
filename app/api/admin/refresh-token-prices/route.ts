import { NextRequest, NextResponse } from "next/server";
import { fetchCoinGeckoPrice } from "@/lib/coingecko";
import {
  getSettings,
  updateExchangeRate,
  updateSellRates,
} from "@/lib/settings";
import { supabaseAdmin } from "@/lib/supabase";

const UPDATED_BY_CRON = "cron";

/**
 * POST /api/admin/refresh-token-prices
 *
 * Fetches CoinGecko prices, applies configured profit margins, and updates
 * platform buy rate (exchange rate), token buy prices (USDC/USDT), and sell rates.
 * Keeps rates fresh when no admin is on the price-action page.
 *
 * Call by: Vercel Cron, cron-job.org (e.g. every 5–15 min).
 * Optional auth: set CRON_SECRET and send Authorization: Bearer <secret>
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = request.headers.get("Authorization");
      const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
      if (token !== secret) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const [price, settings] = await Promise.all([
      fetchCoinGeckoPrice(),
      getSettings(),
    ]);

    const profitSend = settings.profitNgnSend ?? 0;
    const profitUsdc = settings.profitNgnUsdc ?? 0;
    const profitUsdt = settings.profitNgnUsdt ?? 0;
    const profitSendSell = settings.profitNgnSendSell ?? 0;
    const profitUsdcSell = settings.profitNgnUsdcSell ?? 0;
    const profitUsdtSell = settings.profitNgnUsdtSell ?? 0;

    const baseSendToNgn = price.ngn ?? price.usd * 1500;
    const sendToNgn = baseSendToNgn + profitSend;
    const ngnToSend = 1 / sendToNgn;

    await updateExchangeRate(ngnToSend, UPDATED_BY_CRON);

    const prices: Record<string, number> = {};
    if (price.USDC?.ngn != null) prices.USDC = price.USDC.ngn + profitUsdc;
    if (price.USDT?.ngn != null) prices.USDT = price.USDT.ngn + profitUsdt;

    if (Object.keys(prices).length > 0) {
      const updates = Object.entries(prices).map(([token_symbol, buy_price_ngn]) =>
        supabaseAdmin
          .from("token_buy_prices")
          .upsert(
            {
              token_symbol,
              buy_price_ngn,
              updated_by: UPDATED_BY_CRON,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "token_symbol" }
          )
      );
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error);
      if (err?.error) {
        console.error("[Refresh Token Prices] Token prices upsert error:", err.error);
        return NextResponse.json(
          { success: false, error: "Failed to update token buy prices" },
          { status: 500 }
        );
      }
    }

    const sendToNgnSell = baseSendToNgn + profitSendSell;
    const usdcSellPriceNgn =
      price.USDC?.ngn != null ? price.USDC.ngn + profitUsdcSell : undefined;
    const usdtSellPriceNgn =
      price.USDT?.ngn != null ? price.USDT.ngn + profitUsdtSell : undefined;

    await updateSellRates(
      sendToNgnSell,
      usdcSellPriceNgn,
      usdtSellPriceNgn,
      UPDATED_BY_CRON
    );

    console.log(
      "[Refresh Token Prices] Updated buy rate (1 SEND ≈",
      sendToNgn.toFixed(2),
      "NGN), sell rate (1 SEND ≈",
      sendToNgnSell.toFixed(2),
      "NGN)"
    );

    return NextResponse.json({
      success: true,
      message: "Token prices and sell rates updated from CoinGecko",
      buy: { sendToNgn, ngnToSend, usdcNgn: prices.USDC, usdtNgn: prices.USDT },
      sell: { sendToNgnSell, usdcSellPriceNgn, usdtSellPriceNgn },
    });
  } catch (err: unknown) {
    console.error("[Refresh Token Prices] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    const is429 = String(message).includes("429");
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: is429 ? 429 : 500 }
    );
  }
}
