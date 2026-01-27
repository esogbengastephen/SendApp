import { NextResponse } from "next/server";
import { getLiquidityPoolAddress, getPublicClient, getTokenBalance } from "@/lib/blockchain";

const USDC_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;
const ERC20_BALANCE_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
] as const;

/**
 * GET - Liquidity pool wallet address and balances (USDC + SEND on Base)
 * Use this to fund the pool and verify USDC/SEND.
 */
export async function GET() {
  try {
    const poolAddress = getLiquidityPoolAddress();
    const publicClient = getPublicClient();

    const [usdcBalanceRaw, usdcDecimals, sendBalance] = await Promise.all([
      publicClient.readContract({
        address: USDC_ADDRESS_BASE,
        abi: ERC20_BALANCE_ABI,
        functionName: "balanceOf",
        args: [poolAddress as `0x${string}`],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: USDC_ADDRESS_BASE,
        abi: ERC20_BALANCE_ABI,
        functionName: "decimals",
      }) as Promise<number>,
      getTokenBalance(poolAddress).catch(() => "0"),
    ]);

    const usdcBalance = Number(usdcBalanceRaw) / Math.pow(10, usdcDecimals);

    return NextResponse.json({
      success: true,
      poolAddress,
      usdcBalance: usdcBalance.toFixed(6),
      usdcBalanceRaw: usdcBalanceRaw.toString(),
      sendBalance,
      network: "Base",
      note: "Fund the pool with USDC on Base to use the Aerodrome/Paraswap swap path.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
