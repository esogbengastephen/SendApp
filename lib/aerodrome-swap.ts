/**
 * Aerodrome DEX swap on Base.
 * Uses the Aerodrome router directly for USDC → SEND (or USDC → WETH → SEND when no direct pool).
 * Use this as the primary swap path so SEND distribution goes through Aerodrome.
 */

import { parseUnits, formatUnits, maxUint256 } from "viem";
import { getWalletClient, getPublicClient, getNextNonce } from "./blockchain";
import { SEND_TOKEN_ADDRESS } from "./constants";

const USDC_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;
const SEND_DECIMALS = 18;

/** WETH on Base – used when there is no direct USDC–SEND pool on Aerodrome */
const WETH_ADDRESS_BASE = "0x4200000000000000000000000000000000000006";
const WETH_DECIMALS = 18;

/** Aerodrome Router on Base */
const AERODROME_ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43" as `0x${string}`;
/** Aerodrome Pool Factory on Base */
const AERODROME_FACTORY = "0x420DD381b31aEf6683db6B902084cB0FFECe40Da" as `0x${string}`;

/** Route struct: from, to, stable (Aerodrome/Velodrome V2) */
type Route = { from: `0x${string}`; to: `0x${string}`; stable: boolean };

const ROUTER_ABI = [
  {
    inputs: [
      { name: "amountIn", type: "uint256" },
      {
        name: "routes",
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "stable", type: "bool" },
        ],
      },
    ],
    name: "getAmountsOut",
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "amountOut", type: "uint256" },
      {
        name: "routes",
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "stable", type: "bool" },
        ],
      },
    ],
    name: "getAmountsIn",
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      {
        name: "routes",
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "stable", type: "bool" },
        ],
      },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    name: "swapExactTokensForTokens",
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "amountOut", type: "uint256" },
      { name: "amountInMax", type: "uint256" },
      {
        name: "routes",
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "stable", type: "bool" },
        ],
      },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    name: "swapTokensForExactTokens",
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const FACTORY_ABI = [
  {
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "stable", type: "bool" },
    ],
    name: "getPool",
    outputs: [{ name: "pool", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ERC20_APPROVE_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
] as const;

export interface AerodromeSwapResult {
  swapTxHash?: string;
  success: boolean;
  error?: string;
  sendAmountReceived?: string;
}

/** Zero address for pool check */
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Check if a pool exists for the given token pair.
 * Factory uses canonical order (token0 < token1), so we sort addresses.
 */
async function getPoolAddress(tokenA: string, tokenB: string, stable: boolean): Promise<string> {
  const publicClient = getPublicClient();
  const [t0, t1] = tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
  const pool = (await publicClient.readContract({
    address: AERODROME_FACTORY,
    abi: FACTORY_ABI,
    functionName: "getPool",
    args: [t0 as `0x${string}`, t1 as `0x${string}`, stable],
  })) as string;
  return pool ?? ZERO_ADDRESS;
}

/**
 * Result of checking where USDC → SEND can be swapped on Aerodrome (Base).
 * Used by the admin "check SEND routes" API to confirm available swap paths.
 */
export interface SendSwapRoutesCheck {
  /** Chain (e.g. "base") */
  chain: string;
  /** SEND token address checked */
  sendToken: string;
  /** USDC address */
  usdcToken: string;
  /** WETH address */
  wethToken: string;
  /** Aerodrome factory address */
  aerodromeFactory: string;
  /** Direct USDC–SEND pool exists on Aerodrome (any stable type) */
  hasUsdcSendPool: boolean;
  /** USDC–WETH pool exists (first leg of two-hop) */
  hasUsdcWethPool: boolean;
  /** WETH–SEND pool exists (second leg of two-hop) */
  hasWethSendPool: boolean;
  /** USDC → WETH → SEND is possible on Aerodrome */
  canSwapUsdcWethSend: boolean;
  /** USDC → SEND is possible on Aerodrome (direct or two-hop) */
  canSwapUsdcToSend: boolean;
  /** Pool addresses found (for debugging) */
  pools: {
    usdcSendVolatile?: string;
    usdcSendStable?: string;
    usdcWethVolatile?: string;
    usdcWethStable?: string;
    wethSendVolatile?: string;
    wethSendStable?: string;
  };
}

/**
 * Confirm where USDC → SEND can be swapped on Aerodrome (Base).
 * Calls the Aerodrome factory on-chain; no wallet needed.
 * Use this in an admin or diagnostic API to show which routes exist.
 */
export async function checkSendSwapRoutes(): Promise<SendSwapRoutesCheck> {
  const zero = ZERO_ADDRESS.toLowerCase();
  const usdcSendVolatile = await getPoolAddress(USDC_ADDRESS_BASE, SEND_TOKEN_ADDRESS, false);
  const usdcSendStable = await getPoolAddress(USDC_ADDRESS_BASE, SEND_TOKEN_ADDRESS, true);
  const usdcWethVolatile = await getPoolAddress(USDC_ADDRESS_BASE, WETH_ADDRESS_BASE, false);
  const usdcWethStable = await getPoolAddress(USDC_ADDRESS_BASE, WETH_ADDRESS_BASE, true);
  const wethSendVolatile = await getPoolAddress(WETH_ADDRESS_BASE, SEND_TOKEN_ADDRESS, false);
  const wethSendStable = await getPoolAddress(WETH_ADDRESS_BASE, SEND_TOKEN_ADDRESS, true);

  const hasUsdcSendPool =
    usdcSendVolatile?.toLowerCase() !== zero || usdcSendStable?.toLowerCase() !== zero;
  const hasUsdcWethPool =
    usdcWethVolatile?.toLowerCase() !== zero || usdcWethStable?.toLowerCase() !== zero;
  const hasWethSendPool =
    wethSendVolatile?.toLowerCase() !== zero || wethSendStable?.toLowerCase() !== zero;
  const canSwapUsdcWethSend = hasUsdcWethPool && hasWethSendPool;
  const canSwapUsdcToSend = hasUsdcSendPool || canSwapUsdcWethSend;

  return {
    chain: "base",
    sendToken: SEND_TOKEN_ADDRESS,
    usdcToken: USDC_ADDRESS_BASE,
    wethToken: WETH_ADDRESS_BASE,
    aerodromeFactory: AERODROME_FACTORY,
    hasUsdcSendPool,
    hasUsdcWethPool,
    hasWethSendPool,
    canSwapUsdcWethSend,
    canSwapUsdcToSend,
    pools: {
      usdcSendVolatile: usdcSendVolatile !== ZERO_ADDRESS ? usdcSendVolatile : undefined,
      usdcSendStable: usdcSendStable !== ZERO_ADDRESS ? usdcSendStable : undefined,
      usdcWethVolatile: usdcWethVolatile !== ZERO_ADDRESS ? usdcWethVolatile : undefined,
      usdcWethStable: usdcWethStable !== ZERO_ADDRESS ? usdcWethStable : undefined,
      wethSendVolatile: wethSendVolatile !== ZERO_ADDRESS ? wethSendVolatile : undefined,
      wethSendStable: wethSendStable !== ZERO_ADDRESS ? wethSendStable : undefined,
    },
  };
}

/**
 * Build USDC → WETH → SEND route (two-hop on Aerodrome). Returns null if no pools exist.
 */
async function getUsdcWethSendRoutes(): Promise<Route[] | null> {
  for (const s1 of [false, true]) {
    for (const s2 of [false, true]) {
      const p1 = await getPoolAddress(USDC_ADDRESS_BASE, WETH_ADDRESS_BASE, s1);
      const p2 = await getPoolAddress(WETH_ADDRESS_BASE, SEND_TOKEN_ADDRESS, s2);
      if (p1 && p1.toLowerCase() !== ZERO_ADDRESS && p2 && p2.toLowerCase() !== ZERO_ADDRESS) {
        return [
          { from: USDC_ADDRESS_BASE as `0x${string}`, to: WETH_ADDRESS_BASE as `0x${string}`, stable: s1 },
          { from: WETH_ADDRESS_BASE as `0x${string}`, to: SEND_TOKEN_ADDRESS as `0x${string}`, stable: s2 },
        ];
      }
    }
  }
  return null;
}

/**
 * Build routes for USDC → SEND. Tries direct USDC–SEND first (when available), then USDC→WETH→SEND.
 */
async function getUsdcToSendRoutes(): Promise<Route[] | null> {
  // Prefer direct USDC – SEND (one hop) when pool exists
  for (const stable of [false, true]) {
    const pool = await getPoolAddress(USDC_ADDRESS_BASE, SEND_TOKEN_ADDRESS, stable);
    if (pool && pool.toLowerCase() !== ZERO_ADDRESS) {
      return [{ from: USDC_ADDRESS_BASE as `0x${string}`, to: SEND_TOKEN_ADDRESS as `0x${string}`, stable }];
    }
  }
  // Fallback: USDC → WETH → SEND (two-hop) when WETH–SEND pool exists
  const twoHop = await getUsdcWethSendRoutes();
  if (twoHop != null && twoHop.length > 0) {
    return twoHop;
  }
  return null;
}

/**
 * Ensure the liquidity pool has approved USDC (or token) for the Aerodrome router.
 */
async function ensureAllowance(
  tokenAddress: string,
  ownerAddress: string,
  amountWei: bigint
): Promise<void> {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();
  const current = (await publicClient.readContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_APPROVE_ABI,
    functionName: "allowance",
    args: [ownerAddress as `0x${string}`, AERODROME_ROUTER],
  })) as bigint;
  if (current >= amountWei) return;
  const hash = await walletClient.writeContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [AERODROME_ROUTER, maxUint256],
    nonce: await getNextNonce(),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Approve tx failed");
}

/**
 * Sell exact USDC for SEND via Aerodrome. Returns result with sendAmountReceived on success.
 */
export async function tryAerodromeSellUsdc(
  usdcAmountHuman: string
): Promise<AerodromeSwapResult> {
  const wallet = getWalletClient();
  const publicClient = getPublicClient();
  const to = wallet.account.address;
  const routes = await getUsdcToSendRoutes();
  if (!routes || routes.length === 0) {
    return { success: false, error: "No Aerodrome route for USDC → SEND" };
  }
  const amountIn = parseUnits(usdcAmountHuman, USDC_DECIMALS);
  await ensureAllowance(USDC_ADDRESS_BASE, to, amountIn);
  let amountOutMin: bigint;
  let expectedSendOut: bigint | undefined;
  try {
    const amountsOut = (await publicClient.readContract({
      address: AERODROME_ROUTER,
      abi: ROUTER_ABI,
      functionName: "getAmountsOut",
      args: [amountIn, routes],
    })) as bigint[];
    if (!amountsOut?.length) {
      return { success: false, error: "Aerodrome getAmountsOut returned empty" };
    }
    const outAmount = amountsOut[amountsOut.length - 1];
    if (outAmount <= BigInt(0)) {
      return { success: false, error: "Aerodrome quote returned zero SEND" };
    }
    expectedSendOut = outAmount;
    // 1% slippage
    amountOutMin = (outAmount * BigInt(99)) / BigInt(100);
  } catch (e) {
    return {
      success: false,
      error: `Aerodrome quote failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
  try {
    const hash = await wallet.writeContract({
      address: AERODROME_ROUTER,
      abi: ROUTER_ABI,
      functionName: "swapExactTokensForTokens",
      args: [amountIn, amountOutMin, routes, to, deadline],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      return { success: false, error: "Aerodrome swap tx reverted" };
    }
    const sendAmountReceived =
      expectedSendOut != null ? formatUnits(expectedSendOut, SEND_DECIMALS) : undefined;
    return {
      swapTxHash: receipt.transactionHash,
      success: true,
      sendAmountReceived,
    };
  } catch (e) {
    return {
      success: false,
      error: `Aerodrome swap failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Buy exact SEND for USDC via Aerodrome (swapTokensForExactTokens). Returns result on success.
 */
export async function tryAerodromeBuySend(sendAmountHuman: string): Promise<AerodromeSwapResult> {
  const wallet = getWalletClient();
  const publicClient = getPublicClient();
  const to = wallet.account.address;
  const routes = await getUsdcToSendRoutes();
  if (!routes || routes.length === 0) {
    return { success: false, error: "No Aerodrome route for USDC → SEND" };
  }
  const amountOut = parseUnits(sendAmountHuman, SEND_DECIMALS);
  let amountInMax: bigint;
  try {
    const amountsIn = (await publicClient.readContract({
      address: AERODROME_ROUTER,
      abi: ROUTER_ABI,
      functionName: "getAmountsIn",
      args: [amountOut, routes],
    })) as bigint[];
    if (!amountsIn?.length) {
      return { success: false, error: "Aerodrome getAmountsIn returned empty" };
    }
    const usdcNeeded = amountsIn[0];
    if (usdcNeeded <= BigInt(0)) {
      return { success: false, error: "Aerodrome quote returned zero USDC needed" };
    }
    // 2% buffer for slippage
    amountInMax = (usdcNeeded * BigInt(102)) / BigInt(100);
  } catch (e) {
    return {
      success: false,
      error: `Aerodrome getAmountsIn failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  await ensureAllowance(USDC_ADDRESS_BASE, to, amountInMax);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
  try {
    const hash = await wallet.writeContract({
      address: AERODROME_ROUTER,
      abi: ROUTER_ABI,
      functionName: "swapTokensForExactTokens",
      args: [amountOut, amountInMax, routes, to, deadline],
      nonce: await getNextNonce(),
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      return { success: false, error: "Aerodrome swap tx reverted" };
    }
    return {
      swapTxHash: receipt.transactionHash,
      success: true,
    };
  } catch (e) {
    return {
      success: false,
      error: `Aerodrome swap failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Get USDC amount (human) needed to buy exactly sendAmountHuman SEND via Aerodrome.
 * Returns null if no route or quote fails.
 */
export async function getAerodromeUsdcNeededForSend(sendAmountHuman: string): Promise<string | null> {
  const routes = await getUsdcToSendRoutes();
  if (!routes?.length) return null;
  const publicClient = getPublicClient();
  const amountOut = parseUnits(sendAmountHuman, SEND_DECIMALS);
  try {
    const amountsIn = (await publicClient.readContract({
      address: AERODROME_ROUTER,
      abi: ROUTER_ABI,
      functionName: "getAmountsIn",
      args: [amountOut, routes],
    })) as bigint[];
    const usdcWei = amountsIn?.[0];
    if (usdcWei == null || usdcWei <= BigInt(0)) return null;
    return formatUnits(usdcWei, USDC_DECIMALS);
  } catch {
    return null;
  }
}
