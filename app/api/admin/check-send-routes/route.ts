import { NextResponse } from "next/server";
import { checkSendSwapRoutes } from "@/lib/aerodrome-swap";

/**
 * GET /api/admin/check-send-routes
 *
 * Confirms where USDC → SEND can be swapped on Base (Aerodrome).
 * Calls the Aerodrome factory on-chain and returns which pools exist:
 * - Direct USDC–SEND
 * - USDC–WETH (first leg of two-hop)
 * - WETH–SEND (second leg of two-hop)
 *
 * Use this to verify swap availability before or after distribution.
 */
export async function GET() {
  try {
    const result = await checkSendSwapRoutes();
    return NextResponse.json({
      success: true,
      message: result.canSwapUsdcToSend
        ? "USDC → SEND swap is available on Aerodrome (direct or USDC→WETH→SEND)."
        : "No USDC → SEND route on Aerodrome. Create a USDC–SEND or WETH–SEND pool, or use direct SEND transfer.",
      routes: result,
      links: {
        dexscreener: "https://dexscreener.com/base/0xEab49138BA2Ea6dd776220fE26b7b8E446638956",
        aerodromeSwap:
          "https://aerodrome.finance/swap?from=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&to=0xEab49138BA2Ea6dd776220fE26b7b8E446638956&chain0=8453&chain1=8453",
        aerodromeLiquidityUsdcSend:
          "https://aerodrome.finance/liquidity?token0=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&token1=0xEab49138BA2Ea6dd776220fE26b7b8E446638956&chain=8453",
        aerodromeLiquidityWethSend:
          "https://aerodrome.finance/liquidity?token0=0x4200000000000000000000000000000000000006&token1=0xEab49138BA2Ea6dd776220fE26b7b8E446638956&chain=8453",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Check Send Routes] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: message,
        message: "Could not check Aerodrome routes (e.g. RPC or factory call failed).",
      },
      { status: 500 }
    );
  }
}
