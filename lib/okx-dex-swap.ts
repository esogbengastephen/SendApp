/**
 * OKX DEX Aggregator swap on Base.
 * Uses OKX Web3 DEX API for quote + swap transaction; we sign and broadcast via our wallet.
 * Add OKX_API_KEY, OKX_SECRET_KEY, OKX_API_PASSPHRASE (and optionally OKX_PROJECT_ID) to enable.
 */

import crypto from "crypto";
import { parseUnits, formatUnits } from "viem";
import { getWalletClient, getPublicClient, getNextNonce } from "./blockchain";
import { SEND_TOKEN_ADDRESS } from "./constants";

const OKX_API_BASE = "https://web3.okx.com/api/v6";
const BASE_CHAIN_INDEX = "8453";
const USDC_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;
const SEND_DECIMALS = 18;

export interface OkxSwapResult {
  swapTxHash?: string;
  success: boolean;
  error?: string;
  sendAmountReceived?: string;
}

function isOkxConfigured(): boolean {
  const key = process.env.OKX_API_KEY?.trim();
  const secret = process.env.OKX_SECRET_KEY?.trim();
  const pass = process.env.OKX_API_PASSPHRASE?.trim();
  return !!(key && secret && pass);
}

/**
 * Build OKX API signature and headers for GET request.
 * stringToSign = timestamp + method + requestPath + queryString
 */
function getOkxHeaders(
  timestamp: string,
  method: string,
  requestPath: string,
  queryOrBody: string
): Record<string, string> {
  const apiKey = process.env.OKX_API_KEY?.trim();
  const secretKey = process.env.OKX_SECRET_KEY?.trim();
  const passphrase = process.env.OKX_API_PASSPHRASE?.trim();
  const projectId = process.env.OKX_PROJECT_ID?.trim();
  if (!apiKey || !secretKey || !passphrase) {
    throw new Error("OKX API credentials not set (OKX_API_KEY, OKX_SECRET_KEY, OKX_API_PASSPHRASE)");
  }
  const stringToSign = timestamp + method + requestPath + queryOrBody;
  const sign = crypto.createHmac("sha256", secretKey).update(stringToSign).digest("base64");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "OK-ACCESS-KEY": apiKey,
    "OK-ACCESS-SIGN": sign,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": passphrase,
  };
  if (projectId) headers["OK-ACCESS-PROJECT"] = projectId;
  return headers;
}

export type OkxQuoteResult =
  | { success: true; fromTokenAmount?: string; toTokenAmount?: string; router?: string; dexRouterList?: unknown[] }
  | { success: false; error: string; code?: string };

/**
 * GET quote from OKX DEX aggregator.
 * swapMode: exactIn (sell amount of fromToken) or exactOut (buy exact amount of toToken).
 * Note: OKX exactOut on Base supports only Uniswap V3; many pairs (e.g. USDC→SEND) may have no exactOut route.
 */
export async function getOkxQuote(
  fromTokenAddress: string,
  toTokenAddress: string,
  amountWei: string,
  swapMode: "exactIn" | "exactOut" = "exactIn",
  chainIndex: string = BASE_CHAIN_INDEX
): Promise<OkxQuoteResult> {
  if (!isOkxConfigured()) {
    return { success: false, error: "OKX API not configured" };
  }
  const params = new URLSearchParams({
    chainIndex,
    fromTokenAddress,
    toTokenAddress,
    amount: amountWei,
    swapMode,
  });
  const requestPath = "/api/v6/dex/aggregator/quote";
  const queryString = "?" + params.toString();
  const timestamp = new Date().toISOString();
  const headers = getOkxHeaders(timestamp, "GET", requestPath, queryString);
  try {
    const res = await fetch(OKX_API_BASE + "/dex/aggregator/quote" + queryString, { headers });
    const data = (await res.json()) as { code: string; msg?: string; data?: unknown[] };
    if (data.code !== "0" || !data.data?.[0]) {
      const msg = data.msg ?? (typeof data.data === "string" ? data.data : "No quote or route");
      console.warn("[OKX DEX] Quote failed:", data.code, msg);
      return { success: false, error: msg, code: data.code };
    }
    const q = data.data[0] as {
      fromTokenAmount?: string;
      toTokenAmount?: string;
      router?: string;
      dexRouterList?: unknown[];
    };
    return { success: true, ...q };
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    console.warn("[OKX DEX] Quote request error:", msg);
    return { success: false, error: msg };
  }
}

/**
 * GET swap transaction data from OKX (to, from, data, value). We sign and send ourselves.
 */
async function getOkxSwapTx(
  fromTokenAddress: string,
  toTokenAddress: string,
  amountWei: string,
  userWalletAddress: string,
  slippagePercent: string = "1",
  chainIndex: string = BASE_CHAIN_INDEX
): Promise<{ to: string; from: string; data: string; value: string } | null> {
  if (!isOkxConfigured()) return null;
  const params = new URLSearchParams({
    chainIndex,
    fromTokenAddress,
    toTokenAddress,
    amount: amountWei,
    userWalletAddress,
    slippagePercent,
  });
  const requestPath = "/api/v6/dex/aggregator/swap";
  const queryString = "?" + params.toString();
  const timestamp = new Date().toISOString();
  const headers = getOkxHeaders(timestamp, "GET", requestPath, queryString);
  try {
    const res = await fetch(OKX_API_BASE + "/dex/aggregator/swap" + queryString, { headers });
    const data = (await res.json()) as { code: string; msg?: string; data?: { tx?: { to: string; from: string; data: string; value?: string } }[] };
    if (data.code !== "0" || !data.data?.[0]?.tx) {
      console.warn("[OKX DEX] Swap tx failed:", data.msg ?? data);
      return null;
    }
    const tx = data.data[0].tx;
    return {
      to: tx.to,
      from: tx.from,
      data: tx.data,
      value: tx.value ?? "0",
    };
  } catch (e) {
    console.warn("[OKX DEX] Swap tx request error:", (e as Error)?.message);
    return null;
  }
}

/**
 * GET approve transaction data from OKX (for ERC20 spender used by their router).
 */
export async function getOkxApproveTx(
  tokenContractAddress: string,
  approveAmountWei: string,
  chainIndex: string = BASE_CHAIN_INDEX
): Promise<{ data: string; to: string } | null> {
  if (!isOkxConfigured()) return null;
  const params = new URLSearchParams({
    chainIndex,
    tokenContractAddress,
    approveAmount: approveAmountWei,
  });
  const requestPath = "/api/v6/dex/aggregator/approve-transaction";
  const queryString = "?" + params.toString();
  const timestamp = new Date().toISOString();
  const headers = getOkxHeaders(timestamp, "GET", requestPath, queryString);
  try {
    const res = await fetch(OKX_API_BASE + "/dex/aggregator/approve-transaction" + queryString, { headers });
    const data = (await res.json()) as { code: string; msg?: string; data?: { data: string; to?: string }[] };
    if (data.code !== "0" || !data.data?.[0]) {
      console.warn("[OKX DEX] Approve tx failed:", data.msg ?? data);
      return null;
    }
    const d = data.data[0];
    return { data: d.data, to: d.to ?? tokenContractAddress };
  } catch (e) {
    console.warn("[OKX DEX] Approve tx request error:", (e as Error)?.message);
    return null;
  }
}

/**
 * Ensure pool has approved USDC for OKX router (get spender from approve API and send approve tx).
 */
async function ensureOkxUsdcAllowance(ownerAddress: string, amountWei: bigint): Promise<void> {
  const approveData = await getOkxApproveTx(USDC_ADDRESS_BASE, amountWei.toString());
  if (!approveData) {
    throw new Error("OKX approve-transaction API failed");
  }
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();
  const hash = await walletClient.sendTransaction({
    to: approveData.to as `0x${string}`,
    data: approveData.data as `0x${string}`,
    value: BigInt(0),
    nonce: await getNextNonce(),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("OKX USDC approve tx failed");
  console.log(`[OKX DEX] USDC approved: ${hash}`);
}

/**
 * Try to buy exactly sendAmountHuman SEND using OKX DEX.
 * Uses exactOut if OKX supports it; otherwise returns failure (caller can use tryOkxSellUsdc with USDC amount from getUsdcAmountNeededForSend).
 */
export async function tryOkxBuySend(sendAmountHuman: string): Promise<OkxSwapResult> {
  if (!isOkxConfigured()) {
    return { success: false, error: "OKX API not configured" };
  }
  const poolAddress = getWalletClient().account.address;
  const sendWei = parseUnits(sendAmountHuman, SEND_DECIMALS).toString();
  const quoteResult = await getOkxQuote(USDC_ADDRESS_BASE, SEND_TOKEN_ADDRESS, sendWei, "exactOut");
  if (!quoteResult.success || !quoteResult.fromTokenAmount) {
    return {
      success: false,
      error: quoteResult.success ? "OKX no fromTokenAmount" : `OKX exactOut quote: ${quoteResult.error}`,
    };
  }
  const usdcWeiNeeded = quoteResult.fromTokenAmount;
  const swapTx = await getOkxSwapTx(
    USDC_ADDRESS_BASE,
    SEND_TOKEN_ADDRESS,
    usdcWeiNeeded,
    poolAddress,
    "1.5",
    BASE_CHAIN_INDEX
  );
  if (!swapTx) {
    return { success: false, error: "OKX swap tx API failed" };
  }
  try {
    await ensureOkxUsdcAllowance(poolAddress, BigInt(usdcWeiNeeded));
  } catch (e) {
    return { success: false, error: (e as Error)?.message ?? "OKX USDC approval failed" };
  }
  const wallet = getWalletClient();
  const publicClient = getPublicClient();
  const hash = await wallet.sendTransaction({
    to: swapTx.to as `0x${string}`,
    data: swapTx.data as `0x${string}`,
    value: BigInt(swapTx.value),
    nonce: await getNextNonce(),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    return { success: false, error: "OKX swap tx reverted" };
  }
  return { swapTxHash: receipt.transactionHash, success: true };
}

/**
 * Try to sell usdcAmountHuman USDC for SEND using OKX DEX (exactIn).
 */
export async function tryOkxSellUsdc(usdcAmountHuman: string): Promise<OkxSwapResult> {
  if (!isOkxConfigured()) {
    return { success: false, error: "OKX API not configured" };
  }
  const poolAddress = getWalletClient().account.address;
  const usdcWei = parseUnits(usdcAmountHuman, USDC_DECIMALS).toString();
  const quoteResult = await getOkxQuote(USDC_ADDRESS_BASE, SEND_TOKEN_ADDRESS, usdcWei, "exactIn");
  if (!quoteResult.success || !quoteResult.toTokenAmount) {
    return {
      success: false,
      error: quoteResult.success ? "OKX no toTokenAmount" : `OKX quote: ${quoteResult.error}`,
    };
  }
  const swapTx = await getOkxSwapTx(
    USDC_ADDRESS_BASE,
    SEND_TOKEN_ADDRESS,
    usdcWei,
    poolAddress,
    "1.5",
    BASE_CHAIN_INDEX
  );
  if (!swapTx) {
    return { success: false, error: "OKX swap tx API failed" };
  }
  try {
    await ensureOkxUsdcAllowance(poolAddress, BigInt(usdcWei));
  } catch (e) {
    return { success: false, error: (e as Error)?.message ?? "OKX USDC approval failed" };
  }
  const wallet = getWalletClient();
  const publicClient = getPublicClient();
  const hash = await wallet.sendTransaction({
    to: swapTx.to as `0x${string}`,
    data: swapTx.data as `0x${string}`,
    value: BigInt(swapTx.value),
    nonce: await getNextNonce(),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    return { success: false, error: "OKX swap tx reverted" };
  }
  const received = formatUnits(BigInt(quoteResult.toTokenAmount), SEND_DECIMALS);
  return { swapTxHash: receipt.transactionHash, success: true, sendAmountReceived: received };
}

export { isOkxConfigured };
