/**
 * Test OKX DEX integration: quote and optional small swap.
 * GET: returns OKX config status and a quote (USDC → SEND).
 * POST: run a small test swap (only if TEST_OKX_SWAP=1 and OKX credentials set).
 */

import { NextRequest, NextResponse } from "next/server";
import { getOkxQuote, isOkxConfigured, tryOkxSellUsdc } from "@/lib/okx-dex-swap";
import { getLiquidityPoolAddress } from "@/lib/blockchain";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const SEND_TOKEN = process.env.NEXT_PUBLIC_SEND_TOKEN_ADDRESS || "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";

export async function GET(request: NextRequest) {
  try {
    const configured = isOkxConfigured();
    const poolAddress = getLiquidityPoolAddress();

    if (!configured) {
      return NextResponse.json({
        ok: true,
        okxConfigured: false,
        message: "Add OKX_API_KEY, OKX_SECRET_KEY, OKX_API_PASSPHRASE to .env to enable OKX DEX.",
        poolAddress,
      });
    }

    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get("mode") || "quote";
    const amount = searchParams.get("amount") || "1";
    const swapMode = (searchParams.get("swapMode") as "exactIn" | "exactOut") || "exactIn";

    if (mode === "quote") {
      const amountWei =
        swapMode === "exactOut"
          ? BigInt(Math.round(parseFloat(amount) * 1e18)).toString()
          : BigInt(Math.round(parseFloat(amount) * 1e6)).toString();
      const result = await getOkxQuote(USDC_BASE, SEND_TOKEN, amountWei, swapMode);
      if (!result.success) {
        const exactInFallback =
          swapMode === "exactOut"
            ? ` OKX exactOut on Base often only supports Uniswap V3; try exactIn instead (e.g. ?mode=quote&amount=31&swapMode=exactIn for ~31 USDC → SEND).`
            : "";
        return NextResponse.json({
          ok: false,
          okxConfigured: true,
          error: "OKX quote failed: " + result.error + (result.code ? ` (code ${result.code})` : "") + exactInFallback,
          poolAddress,
        });
      }
      return NextResponse.json({
        ok: true,
        okxConfigured: true,
        quote: {
          fromTokenAmount: result.fromTokenAmount,
          toTokenAmount: result.toTokenAmount,
          router: result.router,
        },
        poolAddress,
      });
    }

    return NextResponse.json({
      ok: true,
      okxConfigured: true,
      message: "Use ?mode=quote for quote. POST with body { \"execute\": true } to run test swap (TEST_OKX_SWAP=1).",
      poolAddress,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.TEST_OKX_SWAP?.trim() !== "1") {
      return NextResponse.json(
        { ok: false, error: "Set TEST_OKX_SWAP=1 in .env to allow test swap." },
        { status: 403 }
      );
    }
    if (!isOkxConfigured()) {
      return NextResponse.json(
        { ok: false, error: "OKX API not configured." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const execute = body?.execute === true;
    const usdcAmount = body?.usdcAmount ?? "0.5";

    if (!execute) {
      return NextResponse.json({
        ok: true,
        message: "Send { \"execute\": true, \"usdcAmount\": \"0.5\" } to run a small test swap (USDC → SEND).",
      });
    }

    const result = await tryOkxSellUsdc(usdcAmount);
    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 502 }
      );
    }
    return NextResponse.json({
      ok: true,
      swapTxHash: result.swapTxHash,
      sendAmountReceived: result.sendAmountReceived,
      message: "Test swap succeeded. Check BaseScan for tx.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
