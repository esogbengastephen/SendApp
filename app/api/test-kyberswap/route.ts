/**
 * Test KyberSwap Aggregator integration: quote and optional small swap.
 * GET ?amount=31 → quote only. POST with body { "execute": true, "amount": "0.5" } → run real swap (only if TEST_KYBERSWAP_SWAP=1).
 */

import { NextRequest, NextResponse } from "next/server";
import { getKyberQuote, tryKyberSellUsdc } from "@/lib/kyberswap-dex";
import { getLiquidityPoolAddress } from "@/lib/blockchain";

const USDC_DECIMALS = 6;
const MAX_TEST_SWAP_USDC = 2; // cap for safety

export async function GET(request: NextRequest) {
  try {
    const poolAddress = getLiquidityPoolAddress();
    const searchParams = request.nextUrl.searchParams;
    const amount = searchParams.get("amount") || "31";
    const amountNum = parseFloat(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({
        ok: false,
        error: "Invalid amount; use e.g. ?amount=31",
        poolAddress,
      });
    }
    const amountWei = BigInt(Math.round(amountNum * 10 ** USDC_DECIMALS)).toString();
    const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    const SEND_TOKEN = process.env.NEXT_PUBLIC_SEND_TOKEN_ADDRESS || "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";

    const result = await getKyberQuote(USDC_BASE, SEND_TOKEN, amountWei);
    if (!result.success) {
      return NextResponse.json({
        ok: false,
        error: "KyberSwap quote failed: " + result.error,
        poolAddress,
      });
    }

    return NextResponse.json({
      ok: true,
      quote: {
        amountInUsdc: amount,
        amountOutWei: result.amountOut,
        routerAddress: result.routerAddress,
      },
      poolAddress,
      testSwapHint: "POST with { \"execute\": true, \"amount\": \"0.5\" } to run a small test swap (set TEST_KYBERSWAP_SWAP=1).",
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
    if (process.env.TEST_KYBERSWAP_SWAP?.trim() !== "1") {
      return NextResponse.json({
        ok: false,
        error: "Set TEST_KYBERSWAP_SWAP=1 in .env.local to allow test swap. Use a small amount (e.g. 0.5 USDC).",
      });
    }
    let body: { execute?: boolean; amount?: string } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    if (!body.execute) {
      return NextResponse.json({
        ok: false,
        error: "Send body: { \"execute\": true, \"amount\": \"0.5\" } to run a small KyberSwap test swap.",
      });
    }
    const usdcAmount = (body.amount ?? "0.5").trim();
    const usdcNum = parseFloat(usdcAmount);
    if (!Number.isFinite(usdcNum) || usdcNum <= 0 || usdcNum > MAX_TEST_SWAP_USDC) {
      return NextResponse.json({
        ok: false,
        error: `Amount must be between 0.01 and ${MAX_TEST_SWAP_USDC} USDC.`,
      });
    }
    const poolAddress = getLiquidityPoolAddress();
    const result = await tryKyberSellUsdc(usdcAmount);
    if (!result.success) {
      return NextResponse.json({
        ok: false,
        error: result.error ?? "KyberSwap swap failed",
        poolAddress,
      });
    }
    return NextResponse.json({
      ok: true,
      message: `Swapped ${usdcAmount} USDC → ${result.sendAmountReceived ?? "?"} SEND via KyberSwap`,
      swapTxHash: result.swapTxHash,
      sendAmountReceived: result.sendAmountReceived,
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
