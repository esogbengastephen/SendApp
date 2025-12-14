/**
 * Test 0x API v2 Permit2 with the correct wallet
 */

import axios from "axios";
import { readFileSync } from "fs";
import { join } from "path";

// Load .env.local
const envPath = join(process.cwd(), ".env.local");
let envContent = "";
try {
  envContent = readFileSync(envPath, "utf-8");
  const lines = envContent.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
        process.env[key.trim()] = value;
      }
    }
  }
} catch (error) {
  console.error("Could not read .env.local");
}

const ZEROX_API_URL = "https://api.0x.org/swap/permit2";
const ZEROX_API_KEY = process.env.ZEROX_API_KEY;
const SEND_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_SEND_TOKEN_ADDRESS || "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const walletAddress = "0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2"; // CORRECT WALLET
const sellAmount = "100000000000000000000"; // 100 SEND (18 decimals)

async function test0xV2() {
  console.log("Testing 0x API v2 Permit2...\n");
  console.log(`Sell Token: ${SEND_TOKEN_ADDRESS}`);
  console.log(`Buy Token: ${USDC_ADDRESS}`);
  console.log(`Sell Amount: ${sellAmount} (100 SEND)`);
  console.log(`Taker: ${walletAddress}`);
  console.log(`API Key: ${ZEROX_API_KEY ? "Set" : "Not set"}\n`);

  const params = {
    sellToken: SEND_TOKEN_ADDRESS.toLowerCase(),
    buyToken: USDC_ADDRESS.toLowerCase(),
    sellAmount: sellAmount,
    taker: walletAddress.toLowerCase(), // v2 uses 'taker' not 'takerAddress'
    slippagePercentage: 0.01, // 1%
    chainId: 8453,
  };

  const headers: Record<string, string> = {
    "0x-version": "v2", // Required for v2
  };
  if (ZEROX_API_KEY) {
    headers["0x-api-key"] = ZEROX_API_KEY;
  }

  try {
    console.log("Calling 0x v2 Permit2 quote endpoint...\n");
    const quoteResponse = await axios.get(`${ZEROX_API_URL}/quote`, { params, headers });
    console.log("✅ Quote successful!");
    console.log(`Buy Amount: ${quoteResponse.data.buyAmount}`);
    console.log(`Estimated USDC: ${parseFloat(quoteResponse.data.buyAmount) / 1e6} USDC`);
    if (quoteResponse.data.permit2) {
      console.log(`Permit2: Available`);
    }
    console.log("\n");

    console.log("Calling 0x v2 Permit2 swap endpoint...\n");
    const swapResponse = await axios.get(`${ZEROX_API_URL}/swap`, { params, headers });
    console.log("✅ Swap transaction received!");
    console.log(`To: ${swapResponse.data.to}`);
    console.log(`Data length: ${swapResponse.data.data.length}`);
    if (swapResponse.data.permit2) {
      console.log(`Permit2 data available`);
    }
  } catch (error: any) {
    console.error("❌ Error:", error.response?.data || error.message);
    if (error.response?.data) {
      console.error("Full error:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

test0xV2();

