/**
 * KyberSwap Aggregator API (V1) on Base.
 * No API key required. Uses GET /routes for quote and POST /route/build for calldata; we sign and broadcast.
 * https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/aggregator-api-specification/evm-swaps
 */

import { parseUnits, formatUnits, maxUint256 } from "viem";
import { getWalletClient, getPublicClient, getNextNonce } from "./blockchain";
import { SEND_TOKEN_ADDRESS } from "./constants";

const KYBER_AGGREGATOR_API = "https://aggregator-api.kyberswap.com";
const KYBER_CHAIN_BASE = "base";
const KYBER_CLIENT_ID = process.env.KYBERSWAP_CLIENT_ID?.trim() || "SendXino";
const USDC_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;
const SEND_DECIMALS = 18;

/** KyberSwap MetaAggregationRouter on Base – for USDC approval */
const KYBER_ROUTER_BASE = "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5" as `0x${string}`;

const ERC20_APPROVE_ABI = [
  {
    constant: false,
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
] as const;

export interface KyberSwapResult {
  swapTxHash?: string;
  success: boolean;
  error?: string;
  sendAmountReceived?: string;
}

/** Route summary from KyberSwap GET /routes – passed as-is to POST /route/build */
type KyberRouteSummary = Record<string, unknown>;

export type KyberQuoteResult =
  | { success: true; routeSummary: KyberRouteSummary; routerAddress: string; amountOut: string }
  | { success: false; error: string };

/**
 * [V1] GET swap route for tokenIn → tokenOut with amountIn (exactIn only).
 */
export async function getKyberQuote(
  tokenIn: string,
  tokenOut: string,
  amountInWei: string,
  chain: string = KYBER_CHAIN_BASE
): Promise<KyberQuoteResult> {
  const params = new URLSearchParams({
    tokenIn,
    tokenOut,
    amountIn: amountInWei,
  });
  const url = `${KYBER_AGGREGATOR_API}/${chain}/api/v1/routes?${params}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-client-id": KYBER_CLIENT_ID,
  };
  try {
    const res = await fetch(url, { headers });
    const data = (await res.json()) as {
      code?: number;
      message?: string;
      data?: { routeSummary?: KyberRouteSummary; routerAddress?: string };
    };
    if (data.code !== 0 || !data.data?.routeSummary || !data.data.routerAddress) {
      const msg = data.message ?? "No route or quote";
      console.warn("[KyberSwap] Quote failed:", data.code, msg);
      return { success: false, error: msg };
    }
    const rs = data.data.routeSummary as Record<string, unknown>;
    const amountOut = String(rs.amountOut ?? "0");
    return {
      success: true,
      routeSummary: data.data.routeSummary,
      routerAddress: data.data.routerAddress,
      amountOut,
    };
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    console.warn("[KyberSwap] Quote request error:", msg);
    return { success: false, error: msg };
  }
}

/**
 * [V1] POST build encoded swap data. Requires routeSummary from GET /routes.
 */
async function buildKyberSwapTx(
  routeSummary: KyberRouteSummary,
  sender: string,
  recipient: string,
  slippageBps: number = 150,
  chain: string = KYBER_CHAIN_BASE
): Promise<{ data: string; routerAddress: string; transactionValue: string } | null> {
  const url = `${KYBER_AGGREGATOR_API}/${chain}/api/v1/route/build`;
  const body = {
    routeSummary,
    sender,
    recipient,
    slippageTolerance: slippageBps,
    source: KYBER_CLIENT_ID,
  };
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-client-id": KYBER_CLIENT_ID,
  };
  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const data = (await res.json()) as {
      code?: number;
      message?: string;
      data?: { data?: string; routerAddress?: string; transactionValue?: string };
    };
    if (data.code !== 0 || !data.data?.data || !data.data.routerAddress) {
      console.warn("[KyberSwap] Build failed:", data.message ?? data);
      return null;
    }
    return {
      data: data.data.data,
      routerAddress: data.data.routerAddress,
      transactionValue: data.data.transactionValue ?? "0",
    };
  } catch (e) {
    console.warn("[KyberSwap] Build request error:", (e as Error)?.message);
    return null;
  }
}

async function ensureKyberUsdcAllowance(ownerAddress: string, amountWei: bigint): Promise<void> {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();
  const current = (await publicClient.readContract({
    address: USDC_ADDRESS_BASE as `0x${string}`,
    abi: ERC20_APPROVE_ABI,
    functionName: "allowance",
    args: [ownerAddress as `0x${string}`, KYBER_ROUTER_BASE],
  })) as bigint;
  if (current >= amountWei) {
    console.log(`[KyberSwap] USDC allowance sufficient: ${current}`);
    return;
  }
  console.log(`[KyberSwap] Approving USDC for router (amount: ${amountWei})`);
  const hash = await walletClient.writeContract({
    address: USDC_ADDRESS_BASE as `0x${string}`,
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [KYBER_ROUTER_BASE, maxUint256],
    nonce: await getNextNonce(),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("KyberSwap USDC approve tx failed");
  console.log(`[KyberSwap] USDC approved: ${hash}`);
}

/**
 * Sell usdcAmountHuman USDC for SEND via KyberSwap (exactIn).
 */
export async function tryKyberSellUsdc(usdcAmountHuman: string): Promise<KyberSwapResult> {
  const poolAddress = getWalletClient().account.address;
  const usdcWei = parseUnits(usdcAmountHuman, USDC_DECIMALS).toString();
  const quote = await getKyberQuote(USDC_ADDRESS_BASE, SEND_TOKEN_ADDRESS, usdcWei);
  if (!quote.success || !quote.amountOut) {
    return {
      success: false,
      error: quote.success ? "KyberSwap no amountOut" : `KyberSwap: ${quote.error}`,
    };
  }
  const build = await buildKyberSwapTx(quote.routeSummary, poolAddress, poolAddress, 150);
  if (!build) return { success: false, error: "KyberSwap build tx failed" };
  try {
    await ensureKyberUsdcAllowance(poolAddress, BigInt(usdcWei));
  } catch (e) {
    return { success: false, error: (e as Error)?.message ?? "KyberSwap USDC approval failed" };
  }
  const wallet = getWalletClient();
  const publicClient = getPublicClient();
  const hash = await wallet.sendTransaction({
    to: build.routerAddress as `0x${string}`,
    data: build.data as `0x${string}`,
    value: BigInt(build.transactionValue),
    nonce: await getNextNonce(),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") return { success: false, error: "KyberSwap swap tx reverted" };
  const received = formatUnits(BigInt(quote.amountOut), SEND_DECIMALS);
  return { swapTxHash: receipt.transactionHash, success: true, sendAmountReceived: received };
}

/**
 * Buy exactly sendAmountHuman SEND via KyberSwap by first resolving USDC needed (exactIn path).
 * Caller should pass getUsdcAmountNeededForSend(sendAmountHuman) and add buffer if desired.
 */
export async function tryKyberBuySend(
  sendAmountHuman: string,
  usdcAmountHuman: string
): Promise<KyberSwapResult> {
  return tryKyberSellUsdc(usdcAmountHuman);
}
