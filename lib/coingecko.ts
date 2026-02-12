import { SEND_TOKEN_ADDRESS } from "./constants";

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";

function coinGeckoHeaders(): HeadersInit {
  const headers: HeadersInit = { Accept: "application/json" };
  const apiKey = process.env.COINGECKO_API_KEY;
  if (apiKey) {
    (headers as Record<string, string>)["x-cg-demo-api-key"] = apiKey;
  }
  return headers;
}

export interface CoinGeckoPriceResult {
  usd: number;
  ngn: number | null;
  USDC: { usd: number; ngn: number | null } | null;
  USDT: { usd: number; ngn: number | null } | null;
}

/**
 * Fetch SEND, USDC, USDT prices and NGN rates from CoinGecko.
 * Used by admin coingecko-price API and refresh-token-prices cron.
 */
export async function fetchCoinGeckoPrice(): Promise<CoinGeckoPriceResult> {
  const contractAddress = SEND_TOKEN_ADDRESS.toLowerCase();
  const headers = coinGeckoHeaders();

  const [sendResponse, stablecoinsResponse] = await Promise.all([
    fetch(
      `${COINGECKO_API_BASE}/simple/token_price/base?contract_addresses=${contractAddress}&vs_currencies=usd`,
      { headers }
    ),
    fetch(
      `${COINGECKO_API_BASE}/simple/price?ids=usd-coin,tether&vs_currencies=usd,ngn`,
      { headers }
    ),
  ]);

  if (sendResponse.status === 429 || stablecoinsResponse.status === 429) {
    throw new Error(
      "CoinGecko rate limit (429). Wait a minute and retry, or set COINGECKO_API_KEY for higher limits."
    );
  }

  if (!sendResponse.ok) {
    throw new Error(`CoinGecko API error: ${sendResponse.status}`);
  }

  const sendData = await sendResponse.json();
  const tokenData = sendData[contractAddress];

  if (!tokenData?.usd) {
    throw new Error("Token not found on CoinGecko or price unavailable");
  }

  const sendUsd = tokenData.usd;
  let usdToNgnRate = 1500;
  let sendNgn: number | null = sendUsd * usdToNgnRate;
  let usdcUsd: number | null = null;
  let usdcNgn: number | null = null;
  let usdtUsd: number | null = null;
  let usdtNgn: number | null = null;

  if (stablecoinsResponse.ok) {
    const scData = await stablecoinsResponse.json();
    const usdCoin = scData["usd-coin"];
    const tether = scData["tether"];
    if (usdCoin?.ngn != null) usdToNgnRate = usdCoin.ngn;
    sendNgn = sendUsd * usdToNgnRate;
    if (usdCoin?.usd != null) {
      usdcUsd = usdCoin.usd;
      usdcNgn = usdCoin.ngn ?? usdCoin.usd * usdToNgnRate;
    }
    if (tether?.usd != null) {
      usdtUsd = tether.usd;
      usdtNgn = tether.ngn ?? tether.usd * usdToNgnRate;
    }
  }

  return {
    usd: sendUsd,
    ngn: sendNgn,
    USDC: usdcUsd != null ? { usd: usdcUsd, ngn: usdcNgn } : null,
    USDT: usdtUsd != null ? { usd: usdtUsd, ngn: usdtNgn } : null,
  };
}
