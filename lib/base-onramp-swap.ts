/**
 * Base Network On-Ramp Swap Utility
 * Swaps USDC → SEND on Base. Uses Paraswap first (aggregates Aerodrome); falls back to 0x.
 * Liquidity pool holds USDC, swaps to SEND, then sends to user.
 */

import { parseUnits, formatUnits, maxUint256 } from "viem";
import { getWalletClient, getPublicClient } from "./blockchain";
import { SEND_TOKEN_ADDRESS } from "./constants";

const USDC_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;
const SEND_DECIMALS = 18;
const BASE_CHAIN_ID = 8453;

const PARASWAP_API = "https://apiv5.paraswap.io";
const ZEROX_API_BASE = "https://base.api.0x.org";

/** Paraswap TokenTransferProxy on Base – allowance must be set for swaps to work */
const PARASWAP_TOKEN_TRANSFER_PROXY_BASE = "0x93aAAe79a53759cD164340E4C8766E4Db5331cD7" as `0x${string}`;

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

export interface SwapUsdcToSendResult {
  swapTxHash?: string;
  success: boolean;
  error?: string;
  sendAmountReceived?: string;
}

/** Unmodified priceRoute from Paraswap /prices (required as-is by /transactions) */
type ParaswapPriceRoute = Record<string, unknown>;

/**
 * Ensure the liquidity pool has approved USDC for Paraswap TokenTransferProxy.
 * Call before any Paraswap swap so the build tx can transferFrom the pool.
 */
async function ensureUsdcAllowanceForParaswap(ownerAddress: string, amountWei: bigint): Promise<void> {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();
  const current = (await publicClient.readContract({
    address: USDC_ADDRESS_BASE as `0x${string}`,
    abi: ERC20_APPROVE_ABI,
    functionName: "allowance",
    args: [ownerAddress as `0x${string}`, PARASWAP_TOKEN_TRANSFER_PROXY_BASE],
  })) as bigint;
  if (current >= amountWei) {
    console.log(`[Base OnRamp Swap] USDC allowance for Paraswap sufficient: ${current}`);
    return;
  }
  console.log(`[Base OnRamp Swap] Approving USDC for Paraswap TokenTransferProxy (amount: ${amountWei})`);
  const hash = await walletClient.writeContract({
    address: USDC_ADDRESS_BASE as `0x${string}`,
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [PARASWAP_TOKEN_TRANSFER_PROXY_BASE, maxUint256],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("USDC approve tx failed");
  console.log(`[Base OnRamp Swap] USDC approved: ${hash}`);
}

/**
 * Get Paraswap quote for USDC → SEND on Base (routes via Aerodrome when best).
 * side=BUY + amount=sendAmountWei => buy exact SEND. Omit side => sell srcAmount USDC.
 * Returns the full priceRoute object (must be passed unmodified to build tx).
 */
async function getParaswapQuote(
  amountWei: string,
  _userAddress: string,
  side: "BUY" | "SELL" = "SELL"
): Promise<ParaswapPriceRoute> {
  const params = new URLSearchParams({
    srcToken: USDC_ADDRESS_BASE,
    destToken: SEND_TOKEN_ADDRESS,
    amount: amountWei,
    srcDecimals: String(USDC_DECIMALS),
    destDecimals: String(SEND_DECIMALS),
    network: String(BASE_CHAIN_ID),
    ...(side === "BUY" ? { side: "BUY" } : {}),
  });
  const res = await fetch(`${PARASWAP_API}/prices?${params}`);
  if (!res.ok) throw new Error(`Paraswap prices error: ${res.status}`);
  const data = await res.json();
  if (data.error && !data.priceRoute) throw new Error(data.error || "Paraswap quote failed");
  if (!data.priceRoute?.srcAmount || !data.priceRoute?.destAmount)
    throw new Error("Paraswap: missing priceRoute");
  return data.priceRoute as ParaswapPriceRoute;
}

/**
 * Build Paraswap tx from unmodified priceRoute. Returns { to, data, value } for sending.
 */
async function buildParaswapTx(
  priceRoute: ParaswapPriceRoute,
  userAddress: string
): Promise<{ to: string; data: string; value: string }> {
  const pr = priceRoute as Record<string, unknown>;
  const body = {
    priceRoute,
    userAddress,
    srcToken: pr.srcToken,
    destToken: pr.destToken,
    srcAmount: pr.srcAmount,
    destAmount: pr.destAmount,
    srcDecimals: pr.srcDecimals,
    destDecimals: pr.destDecimals,
  };
  const res = await fetch(`${PARASWAP_API}/transactions/${BASE_CHAIN_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Paraswap buildTx error: ${res.status} ${t}`);
  }
  const tx = await res.json();
  if (!tx.to || !tx.data) throw new Error("Paraswap: missing to/data in buildTx");
  return {
    to: tx.to,
    data: tx.data,
    value: tx.value ?? "0",
  };
}

/**
 * Try Paraswap (Aerodrome) for USDC → SEND; return null if not possible.
 */
async function tryParaswapBuySend(
  sendAmountHuman: string,
  userAddress: string
): Promise<SwapUsdcToSendResult> {
  const sendWei = parseUnits(sendAmountHuman, SEND_DECIMALS).toString();
  const priceRoute = await getParaswapQuote(sendWei, userAddress, "BUY");
  const srcAmountWei = BigInt(String((priceRoute as Record<string, unknown>).srcAmount ?? 0));
  await ensureUsdcAllowanceForParaswap(userAddress, srcAmountWei);
  const tx = await buildParaswapTx(priceRoute, userAddress);
  const wallet = getWalletClient();
  const publicClient = getPublicClient();
  const hash = await wallet.sendTransaction({
    to: tx.to as `0x${string}`,
    data: tx.data as `0x${string}`,
    value: BigInt(tx.value),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Swap tx failed on-chain");
  return { swapTxHash: receipt.transactionHash, success: true };
}

/**
 * Try Paraswap (Aerodrome) for selling usdcAmountHuman USDC → SEND.
 */
async function tryParaswapSellUsdc(
  usdcAmountHuman: string,
  userAddress: string
): Promise<SwapUsdcToSendResult> {
  const usdcWei = parseUnits(usdcAmountHuman, USDC_DECIMALS);
  await ensureUsdcAllowanceForParaswap(userAddress, usdcWei);
  const priceRoute = await getParaswapQuote(usdcWei.toString(), userAddress, "SELL");
  const tx = await buildParaswapTx(priceRoute, userAddress);
  const wallet = getWalletClient();
  const publicClient = getPublicClient();
  const hash = await wallet.sendTransaction({
    to: tx.to as `0x${string}`,
    data: tx.data as `0x${string}`,
    value: BigInt(tx.value),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Swap tx failed on-chain");
  const destAmount = String((priceRoute as { destAmount?: string }).destAmount ?? "0");
  const received = formatUnits(BigInt(destAmount), SEND_DECIMALS);
  return {
    swapTxHash: receipt.transactionHash,
    success: true,
    sendAmountReceived: received,
  };
}

/**
 * Get 0x swap quote: buy exactly sendAmountWei of buyToken (SEND) by selling USDC
 */
async function get0xQuoteBuySend(
  buyTokenAmountWei: string,
  takerAddress: string
): Promise<{ to: string; data: string; value: string }> {
  const params = new URLSearchParams({
    sellToken: USDC_ADDRESS_BASE,
    buyToken: SEND_TOKEN_ADDRESS,
    buyAmount: buyTokenAmountWei,
    takerAddress,
    slippagePercentage: "1",
  });
  const url = `${ZEROX_API_BASE}/swap/v1/quote?${params}`;
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`0x API error: ${response.status} ${response.statusText} - ${text}`);
  }
  const quote = await response.json();
  if (!quote.to || !quote.data) throw new Error("Invalid quote from 0x: missing to or data");
  return { to: quote.to, data: quote.data, value: quote.value ?? "0" };
}

/**
 * Get 0x swap quote: sell usdcAmountWei USDC, receive SEND
 * Returns quote plus expected buyAmount in wei for SEND
 */
async function get0xQuoteSellUsdc(
  usdcAmountWei: string,
  takerAddress: string
): Promise<{ to: string; data: string; value: string; buyAmountWei: string }> {
  const params = new URLSearchParams({
    sellToken: USDC_ADDRESS_BASE,
    buyToken: SEND_TOKEN_ADDRESS,
    sellAmount: usdcAmountWei,
    takerAddress,
    slippagePercentage: "1",
  });
  const url = `${ZEROX_API_BASE}/swap/v1/quote?${params}`;
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`0x API error: ${response.status} ${response.statusText} - ${text}`);
  }
  const quote = await response.json();
  if (!quote.to || !quote.data) throw new Error("Invalid quote from 0x: missing to or data");
  const buyAmountWei = String(quote.buyAmount ?? quote.buyTokenAmount ?? "0");
  return {
    to: quote.to,
    data: quote.data,
    value: quote.value ?? "0",
    buyAmountWei,
  };
}

/**
 * Swap USDC → SEND by buying exactly sendAmount SEND. Uses Paraswap (Aerodrome) first, then 0x.
 */
export async function swapUsdcToSend(sendAmountHuman: string): Promise<SwapUsdcToSendResult> {
  const poolAddress = getWalletClient().account.address;
  try {
    console.log(`[Base OnRamp Swap] Trying Paraswap (Aerodrome) to buy ${sendAmountHuman} SEND`);
    const out = await tryParaswapBuySend(sendAmountHuman, poolAddress);
    if (out.success) {
      console.log(`[Base OnRamp Swap] Paraswap swap successful: ${out.swapTxHash}`);
      return out;
    }
  } catch (e) {
    console.warn("[Base OnRamp Swap] Paraswap failed, trying 0x:", (e as Error)?.message);
  }
  try {
    const sendWei = parseUnits(sendAmountHuman, SEND_DECIMALS).toString();
    const quote = await get0xQuoteBuySend(sendWei, poolAddress);
    const wallet = getWalletClient();
    const publicClient = getPublicClient();
    const hash = await wallet.sendTransaction({
      to: quote.to as `0x${string}`,
      data: quote.data as `0x${string}`,
      value: BigInt(quote.value),
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Swap failed on-chain");
    return { swapTxHash: receipt.transactionHash, success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Swap a fixed amount of USDC → SEND (e.g. 1 USDC). Uses Paraswap (Aerodrome) first, then 0x.
 */
export async function swapUsdcToSendBySellingUsdc(
  usdcAmountHuman: string
): Promise<SwapUsdcToSendResult> {
  const poolAddress = getWalletClient().account.address;
  let paraswapError: string | undefined;
  try {
    console.log(`[Base OnRamp Swap] Trying Paraswap (Aerodrome) to sell ${usdcAmountHuman} USDC → SEND`);
    const out = await tryParaswapSellUsdc(usdcAmountHuman, poolAddress);
    if (out.success) {
      console.log(`[Base OnRamp Swap] Paraswap swap received: ${out.sendAmountReceived} SEND`);
      return out;
    }
    paraswapError = out.error;
  } catch (e) {
    paraswapError = e instanceof Error ? e.message : String(e);
    console.warn("[Base OnRamp Swap] Paraswap failed, trying 0x:", paraswapError);
  }
  try {
    const usdcWei = parseUnits(usdcAmountHuman, USDC_DECIMALS).toString();
    const quote = await get0xQuoteSellUsdc(usdcWei, poolAddress);
    const wallet = getWalletClient();
    const publicClient = getPublicClient();
    const hash = await wallet.sendTransaction({
      to: quote.to as `0x${string}`,
      data: quote.data as `0x${string}`,
      value: BigInt(quote.value),
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Swap failed on-chain");
    const received = formatUnits(BigInt(quote.buyAmountWei), SEND_DECIMALS);
    return { swapTxHash: receipt.transactionHash, success: true, sendAmountReceived: received };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: paraswapError ? `Paraswap: ${paraswapError}. 0x fallback: ${errMsg}` : errMsg,
    };
  }
}
