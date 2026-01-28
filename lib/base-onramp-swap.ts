/**
 * Base Network On-Ramp Swap Utility
 * Swaps USDC → SEND on Base. Uses Aerodrome router first (direct DEX); then Paraswap, 0x, USDC→WETH→SEND.
 * Liquidity pool holds USDC, swaps to SEND, then sends to user.
 */

import { parseUnits, formatUnits, maxUint256 } from "viem";
import { getWalletClient, getPublicClient, getNextNonce } from "./blockchain";
import { SEND_TOKEN_ADDRESS } from "./constants";
import {
  tryAerodromeBuySend,
  tryAerodromeSellUsdc,
  getAerodromeUsdcNeededForSend,
} from "./aerodrome-swap";

const USDC_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;
const SEND_DECIMALS = 18;
const BASE_CHAIN_ID = 8453;

/** WETH on Base – used as intermediate when USDC→SEND has no route */
const WETH_ADDRESS_BASE = "0x4200000000000000000000000000000000000006";
const WETH_DECIMALS = 18;

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
    nonce: await getNextNonce(),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("USDC approve tx failed");
  console.log(`[Base OnRamp Swap] USDC approved: ${hash}`);
}

/**
 * Ensure token allowance for Paraswap TokenTransferProxy (generic for any ERC20).
 */
async function ensureTokenAllowance(
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
    args: [ownerAddress as `0x${string}`, PARASWAP_TOKEN_TRANSFER_PROXY_BASE],
  })) as bigint;
  if (current >= amountWei) {
    console.log(`[Base OnRamp Swap] Token ${tokenAddress} allowance for Paraswap sufficient: ${current}`);
    return;
  }
  console.log(`[Base OnRamp Swap] Approving token ${tokenAddress} for Paraswap (amount: ${amountWei})`);
  const hash = await walletClient.writeContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [PARASWAP_TOKEN_TRANSFER_PROXY_BASE, maxUint256],
    nonce: await getNextNonce(),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Token approve tx failed");
  console.log(`[Base OnRamp Swap] Token approved: ${hash}`);
}

/**
 * Get Paraswap quote for any src → dest on Base.
 * amountWei is src amount for SELL, dest amount for BUY.
 */
async function getParaswapQuoteGeneric(
  srcToken: string,
  destToken: string,
  amountWei: string,
  srcDecimals: number,
  destDecimals: number,
  side: "BUY" | "SELL" = "SELL"
): Promise<ParaswapPriceRoute> {
  const params = new URLSearchParams({
    srcToken,
    destToken,
    amount: amountWei,
    srcDecimals: String(srcDecimals),
    destDecimals: String(destDecimals),
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
    nonce: await getNextNonce(),
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
 * 0x quote: sell sellAmountWei of sellToken, receive buyToken.
 */
async function get0xQuoteSell(
  sellToken: string,
  buyToken: string,
  sellAmountWei: string,
  takerAddress: string
): Promise<{ to: string; data: string; value: string; buyAmountWei?: string }> {
  const params = new URLSearchParams({
    sellToken,
    buyToken,
    sellAmount: sellAmountWei,
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
  return { to: quote.to, data: quote.data, value: quote.value ?? "0", buyAmountWei };
}

/**
 * 0x quote: buy buyAmountWei of buyToken by selling sellToken.
 */
async function get0xQuoteBuy(
  sellToken: string,
  buyToken: string,
  buyAmountWei: string,
  takerAddress: string
): Promise<{ to: string; data: string; value: string }> {
  const params = new URLSearchParams({
    sellToken,
    buyToken,
    buyAmount: buyAmountWei,
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
 * Fallback: USDC → WETH → SEND (buy exact sendAmount SEND). Use when direct USDC→SEND has no route.
 */
async function trySwapUsdcToWethThenWethToSend(sendAmountHuman: string): Promise<SwapUsdcToSendResult> {
  const poolAddress = getWalletClient().account.address;
  const wallet = getWalletClient();
  const publicClient = getPublicClient();
  const sendWei = parseUnits(sendAmountHuman, SEND_DECIMALS).toString();

  // Step 1: Get WETH amount needed to buy sendAmount SEND (WETH → SEND, BUY)
  let wethAmountWei: string;
  try {
    const priceRouteWethSend = await getParaswapQuoteGeneric(
      WETH_ADDRESS_BASE,
      SEND_TOKEN_ADDRESS,
      sendWei,
      WETH_DECIMALS,
      SEND_DECIMALS,
      "BUY"
    );
    wethAmountWei = String((priceRouteWethSend as Record<string, unknown>).srcAmount ?? "0");
    if (!wethAmountWei || BigInt(wethAmountWei) <= BigInt(0)) throw new Error("Paraswap: no WETH amount for SEND buy");
  } catch (e) {
    try {
      const res = await fetch(`${ZEROX_API_BASE}/swap/v1/quote?sellToken=${WETH_ADDRESS_BASE}&buyToken=${SEND_TOKEN_ADDRESS}&buyAmount=${sendWei}&takerAddress=${poolAddress}&slippagePercentage=1`);
      if (!res.ok) throw new Error(`0x ${res.status}`);
      const q = await res.json();
      wethAmountWei = String(q.sellAmount ?? q.sellTokenAmount ?? "0");
      if (!wethAmountWei || BigInt(wethAmountWei) <= BigInt(0)) throw new Error("0x: no sellAmount");
    } catch (e2) {
      return { success: false, error: `WETH→SEND quote failed: ${(e as Error)?.message ?? e}. ${(e2 as Error)?.message ?? e2}` };
    }
  }

  // Step 2: Swap USDC → WETH (buy wethAmountWei WETH with USDC)
  let tx1Hash: string | undefined;
  try {
    const priceRouteUsdcWeth = await getParaswapQuoteGeneric(
      USDC_ADDRESS_BASE,
      WETH_ADDRESS_BASE,
      wethAmountWei,
      USDC_DECIMALS,
      WETH_DECIMALS,
      "BUY"
    );
    const srcAmountUsdc = BigInt(String((priceRouteUsdcWeth as Record<string, unknown>).srcAmount ?? 0));
    await ensureUsdcAllowanceForParaswap(poolAddress, srcAmountUsdc);
    const tx1 = await buildParaswapTx(priceRouteUsdcWeth, poolAddress);
    const hash1 = await wallet.sendTransaction({
      to: tx1.to as `0x${string}`,
      data: tx1.data as `0x${string}`,
      value: BigInt(tx1.value),
      nonce: await getNextNonce(),
    });
    const rec1 = await publicClient.waitForTransactionReceipt({ hash: hash1 });
    if (rec1.status !== "success") throw new Error("USDC→WETH tx failed");
    tx1Hash = rec1.transactionHash;
  } catch (e1) {
    try {
      const res0 = await fetch(`${ZEROX_API_BASE}/swap/v1/quote?sellToken=${USDC_ADDRESS_BASE}&buyToken=${WETH_ADDRESS_BASE}&buyAmount=${wethAmountWei}&takerAddress=${poolAddress}&slippagePercentage=1`);
      if (!res0.ok) throw new Error(`0x ${res0.status}`);
      const q0 = await res0.json();
      if (!q0.to || !q0.data) throw new Error("0x: missing to/data");
      const sellAmountUsdc = String(q0.sellAmount ?? q0.sellTokenAmount ?? "0");
      await ensureUsdcAllowanceForParaswap(poolAddress, BigInt(sellAmountUsdc));
      const hash1 = await wallet.sendTransaction({
        to: q0.to as `0x${string}`,
        data: q0.data as `0x${string}`,
        value: BigInt(q0.value ?? "0"),
        nonce: await getNextNonce(),
      });
      const rec1 = await publicClient.waitForTransactionReceipt({ hash: hash1 });
      if (rec1.status !== "success") throw new Error("USDC→WETH tx failed");
      tx1Hash = rec1.transactionHash;
    } catch (e2) {
      return { success: false, error: `USDC→WETH failed: ${(e1 as Error)?.message}. ${(e2 as Error)?.message}` };
    }
  }

  // Step 3: Approve WETH for Paraswap
  await ensureTokenAllowance(WETH_ADDRESS_BASE, poolAddress, BigInt(wethAmountWei));

  // Step 4: Swap WETH → SEND (buy sendAmount SEND)
  try {
    const priceRouteWethSend = await getParaswapQuoteGeneric(
      WETH_ADDRESS_BASE,
      SEND_TOKEN_ADDRESS,
      sendWei,
      WETH_DECIMALS,
      SEND_DECIMALS,
      "BUY"
    );
    const tx2 = await buildParaswapTx(priceRouteWethSend, poolAddress);
    const hash2 = await wallet.sendTransaction({
      to: tx2.to as `0x${string}`,
      data: tx2.data as `0x${string}`,
      value: BigInt(tx2.value),
      nonce: await getNextNonce(),
    });
    const rec2 = await publicClient.waitForTransactionReceipt({ hash: hash2 });
    if (rec2.status !== "success") throw new Error("WETH→SEND tx failed");
    console.log(`[Base OnRamp Swap] USDC→WETH→SEND (buy) successful. Tx1: ${tx1Hash}, Tx2: ${rec2.transactionHash}`);
    return { swapTxHash: rec2.transactionHash, success: true };
  } catch (e3) {
    try {
      const quote0x = await get0xQuoteBuy(WETH_ADDRESS_BASE, SEND_TOKEN_ADDRESS, sendWei, poolAddress);
      const hash2 = await wallet.sendTransaction({
        to: quote0x.to as `0x${string}`,
        data: quote0x.data as `0x${string}`,
        value: BigInt(quote0x.value),
        nonce: await getNextNonce(),
      });
      const rec2 = await publicClient.waitForTransactionReceipt({ hash: hash2 });
      if (rec2.status !== "success") throw new Error("WETH→SEND tx failed");
      console.log(`[Base OnRamp Swap] USDC→WETH→SEND (buy, 0x) successful. Tx1: ${tx1Hash}, Tx2: ${rec2.transactionHash}`);
      return { swapTxHash: rec2.transactionHash, success: true };
    } catch (e4) {
      return { success: false, error: `WETH→SEND failed: ${(e3 as Error)?.message}. ${(e4 as Error)?.message}` };
    }
  }
}

/**
 * Fallback: USDC → WETH → SEND (sell usdcAmountHuman USDC). Use when direct USDC→SEND has no route.
 */
async function trySwapUsdcToWethThenWethToSendBySellingUsdc(usdcAmountHuman: string): Promise<SwapUsdcToSendResult> {
  const poolAddress = getWalletClient().account.address;
  const wallet = getWalletClient();
  const publicClient = getPublicClient();
  const usdcWei = parseUnits(usdcAmountHuman, USDC_DECIMALS).toString();

  const BALANCE_OF_ABI = [{ constant: true, inputs: [{ name: "account", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], type: "function" }] as const;

  // Step 1: Swap USDC → WETH
  let tx1Hash: string | undefined;
  try {
    const priceRoute = await getParaswapQuoteGeneric(
      USDC_ADDRESS_BASE,
      WETH_ADDRESS_BASE,
      usdcWei,
      USDC_DECIMALS,
      WETH_DECIMALS,
      "SELL"
    );
    await ensureUsdcAllowanceForParaswap(poolAddress, BigInt(usdcWei));
    const tx1 = await buildParaswapTx(priceRoute, poolAddress);
    const hash1 = await wallet.sendTransaction({
      to: tx1.to as `0x${string}`,
      data: tx1.data as `0x${string}`,
      value: BigInt(tx1.value),
      nonce: await getNextNonce(),
    });
    const rec1 = await publicClient.waitForTransactionReceipt({ hash: hash1 });
    if (rec1.status !== "success") throw new Error("USDC→WETH tx failed");
    tx1Hash = rec1.transactionHash;
  } catch (e1) {
    try {
      const quote1 = await get0xQuoteSell(USDC_ADDRESS_BASE, WETH_ADDRESS_BASE, usdcWei, poolAddress);
      await ensureUsdcAllowanceForParaswap(poolAddress, BigInt(usdcWei));
      const hash1 = await wallet.sendTransaction({
        to: quote1.to as `0x${string}`,
        data: quote1.data as `0x${string}`,
        value: BigInt(quote1.value),
        nonce: await getNextNonce(),
      });
      const rec1 = await publicClient.waitForTransactionReceipt({ hash: hash1 });
      if (rec1.status !== "success") throw new Error("USDC→WETH tx failed");
      tx1Hash = rec1.transactionHash;
    } catch (e2) {
      return { success: false, error: `USDC→WETH failed: ${(e1 as Error)?.message}. ${(e2 as Error)?.message}` };
    }
  }

  // Step 2: Get WETH balance
  const wethBal = (await publicClient.readContract({
    address: WETH_ADDRESS_BASE as `0x${string}`,
    abi: BALANCE_OF_ABI,
    functionName: "balanceOf",
    args: [poolAddress as `0x${string}`],
  })) as bigint;
  const wethAmountWei = wethBal.toString();
  if (wethBal <= BigInt(0)) return { success: false, error: "No WETH received from USDC→WETH swap" };

  // Step 3: Approve WETH for Paraswap
  await ensureTokenAllowance(WETH_ADDRESS_BASE, poolAddress, wethBal);

  // Step 4: Swap WETH → SEND
  try {
    const priceRoute = await getParaswapQuoteGeneric(
      WETH_ADDRESS_BASE,
      SEND_TOKEN_ADDRESS,
      wethAmountWei,
      WETH_DECIMALS,
      SEND_DECIMALS,
      "SELL"
    );
    const tx2 = await buildParaswapTx(priceRoute, poolAddress);
    const hash2 = await wallet.sendTransaction({
      to: tx2.to as `0x${string}`,
      data: tx2.data as `0x${string}`,
      value: BigInt(tx2.value),
      nonce: await getNextNonce(),
    });
    const rec2 = await publicClient.waitForTransactionReceipt({ hash: hash2 });
    if (rec2.status !== "success") throw new Error("WETH→SEND tx failed");
    const destAmount = String((priceRoute as Record<string, unknown>).destAmount ?? "0");
    const received = formatUnits(BigInt(destAmount), SEND_DECIMALS);
    console.log(`[Base OnRamp Swap] USDC→WETH→SEND (sell) successful. Tx1: ${tx1Hash}, Tx2: ${rec2.transactionHash}, SEND: ${received}`);
    return { swapTxHash: rec2.transactionHash, success: true, sendAmountReceived: received };
  } catch (e3) {
    try {
      const quote2 = await get0xQuoteSell(WETH_ADDRESS_BASE, SEND_TOKEN_ADDRESS, wethAmountWei, poolAddress);
      const hash2 = await wallet.sendTransaction({
        to: quote2.to as `0x${string}`,
        data: quote2.data as `0x${string}`,
        value: BigInt(quote2.value),
        nonce: await getNextNonce(),
      });
      const rec2 = await publicClient.waitForTransactionReceipt({ hash: hash2 });
      if (rec2.status !== "success") throw new Error("WETH→SEND tx failed");
      const received = quote2.buyAmountWei ? formatUnits(BigInt(quote2.buyAmountWei), SEND_DECIMALS) : "0";
      console.log(`[Base OnRamp Swap] USDC→WETH→SEND (sell, 0x) successful. Tx1: ${tx1Hash}, Tx2: ${rec2.transactionHash}, SEND: ${received}`);
      return { swapTxHash: rec2.transactionHash, success: true, sendAmountReceived: received };
    } catch (e4) {
      return { success: false, error: `WETH→SEND failed: ${(e3 as Error)?.message}. ${(e4 as Error)?.message}` };
    }
  }
}

/**
 * Get the USDC amount (human) needed to buy exactly sendAmountHuman SEND.
 * Tries Aerodrome first, then Paraswap, then 0x.
 */
export async function getUsdcAmountNeededForSend(sendAmountHuman: string): Promise<string | null> {
  const aerodromeUsdc = await getAerodromeUsdcNeededForSend(sendAmountHuman);
  if (aerodromeUsdc != null && aerodromeUsdc !== "") return aerodromeUsdc;
  const poolAddress = getWalletClient().account.address;
  const sendWei = parseUnits(sendAmountHuman, SEND_DECIMALS).toString();
  try {
    const priceRoute = await getParaswapQuote(sendWei, poolAddress, "BUY");
    const srcAmountWei = String((priceRoute as Record<string, unknown>).srcAmount ?? "0");
    const usdcHuman = formatUnits(BigInt(srcAmountWei), USDC_DECIMALS);
    if (BigInt(srcAmountWei) <= BigInt(0)) return null;
    return usdcHuman;
  } catch {
    try {
      const res = await fetch(
        `${ZEROX_API_BASE}/swap/v1/quote?sellToken=${USDC_ADDRESS_BASE}&buyToken=${SEND_TOKEN_ADDRESS}&buyAmount=${sendWei}&takerAddress=${poolAddress}&slippagePercentage=1`
      );
      if (!res.ok) return null;
      const q = await res.json();
      const sellAmountWei = String(q.sellAmount ?? q.sellTokenAmount ?? "0");
      if (BigInt(sellAmountWei) <= BigInt(0)) return null;
      return formatUnits(BigInt(sellAmountWei), USDC_DECIMALS);
    } catch {
      return null;
    }
  }
}

/**
 * Swap USDC → SEND by buying exactly sendAmount SEND. Aerodrome first, then Paraswap → 0x → USDC→WETH→SEND.
 */
export async function swapUsdcToSend(sendAmountHuman: string): Promise<SwapUsdcToSendResult> {
  const poolAddress = getWalletClient().account.address;
  try {
    console.log(`[Base OnRamp Swap] Trying Aerodrome to buy ${sendAmountHuman} SEND`);
    const out = await tryAerodromeBuySend(sendAmountHuman);
    if (out.success) {
      console.log(`[Base OnRamp Swap] Aerodrome swap successful: ${out.swapTxHash}`);
      return out;
    }
    console.warn("[Base OnRamp Swap] Aerodrome failed:", out.error);
  } catch (e) {
    console.warn("[Base OnRamp Swap] Aerodrome failed, trying Paraswap:", (e as Error)?.message);
  }
  try {
    console.log(`[Base OnRamp Swap] Trying Paraswap to buy ${sendAmountHuman} SEND`);
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
    const directError = error instanceof Error ? error.message : String(error);
    console.warn("[Base OnRamp Swap] Direct USDC→SEND failed, trying USDC→WETH→SEND:", directError);
    const wethOut = await trySwapUsdcToWethThenWethToSend(sendAmountHuman);
    if (wethOut.success) return wethOut;
    return { success: false, error: `${directError}. WETH fallback: ${wethOut.error ?? "failed"}` };
  }
}

/**
 * Swap a fixed amount of USDC → SEND (e.g. 1 USDC). Aerodrome first, then Paraswap → 0x → USDC→WETH→SEND.
 */
export async function swapUsdcToSendBySellingUsdc(
  usdcAmountHuman: string
): Promise<SwapUsdcToSendResult> {
  const poolAddress = getWalletClient().account.address;
  let paraswapError: string | undefined;
  try {
    console.log(`[Base OnRamp Swap] Trying Aerodrome to sell ${usdcAmountHuman} USDC → SEND`);
    const out = await tryAerodromeSellUsdc(usdcAmountHuman);
    if (out.success) {
      console.log(`[Base OnRamp Swap] Aerodrome swap received: ${out.sendAmountReceived} SEND`);
      return out;
    }
    console.warn("[Base OnRamp Swap] Aerodrome failed:", out.error);
  } catch (e) {
    console.warn("[Base OnRamp Swap] Aerodrome failed, trying Paraswap:", (e as Error)?.message);
  }
  try {
    console.log(`[Base OnRamp Swap] Trying Paraswap to sell ${usdcAmountHuman} USDC → SEND`);
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
      nonce: await getNextNonce(),
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Swap failed on-chain");
    const received = formatUnits(BigInt(quote.buyAmountWei), SEND_DECIMALS);
    return { swapTxHash: receipt.transactionHash, success: true, sendAmountReceived: received };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.warn("[Base OnRamp Swap] Direct USDC→SEND failed, trying USDC→WETH→SEND:", errMsg);
    const wethOut = await trySwapUsdcToWethThenWethToSendBySellingUsdc(usdcAmountHuman);
    if (wethOut.success) return wethOut;
    return {
      success: false,
      error: paraswapError ? `Paraswap: ${paraswapError}. 0x: ${errMsg}. WETH fallback: ${wethOut.error ?? "failed"}` : `${errMsg}. WETH fallback: ${wethOut.error ?? "failed"}`,
    };
  }
}
