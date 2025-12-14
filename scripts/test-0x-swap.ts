/**
 * Test 0x Swap API directly
 * This script tests if 0x can find a route for SEND -> USDC swap
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

const ZEROX_API_URL = "https://api.0x.org/swap/v1";
const ZEROX_API_KEY = process.env.ZEROX_API_KEY;
const SEND_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_SEND_TOKEN_ADDRESS || "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const walletAddress = "0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2";
const sellAmount = "100000000000000000000"; // 100 SEND (18 decimals)

async function test0xSwap() {
  console.log("Testing 0x Swap API...\n");
  console.log(`Sell Token: ${SEND_TOKEN_ADDRESS}`);
  console.log(`Buy Token: ${USDC_ADDRESS}`);
  console.log(`Sell Amount: ${sellAmount} (100 SEND)`);
  console.log(`Taker: ${walletAddress}`);
  console.log(`API Key: ${ZEROX_API_KEY ? "Set" : "Not set"}\n`);

  const params = {
    sellToken: SEND_TOKEN_ADDRESS.toLowerCase(),
    buyToken: USDC_ADDRESS.toLowerCase(),
    sellAmount: sellAmount,
    takerAddress: walletAddress.toLowerCase(),
    slippagePercentage: 0.01, // 1%
    chainId: 8453,
  };

  const headers: Record<string, string> = {};
  if (ZEROX_API_KEY) {
    headers["0x-api-key"] = ZEROX_API_KEY;
  }

  try {
    console.log("Calling 0x quote endpoint...\n");
    const quoteResponse = await axios.get(`${ZEROX_API_URL}/quote`, { params, headers });
    console.log("✅ Quote successful!");
    console.log(`Buy Amount: ${quoteResponse.data.buyAmount}`);
    console.log(`Estimated USDC: ${parseFloat(quoteResponse.data.buyAmount) / 1e6} USDC\n`);

    console.log("Calling 0x swap endpoint...\n");
    const swapResponse = await axios.get(`${ZEROX_API_URL}/swap`, { params, headers });
    console.log("✅ Swap transaction received!");
    console.log(`To: ${swapResponse.data.to}`);
    console.log(`Data length: ${swapResponse.data.data.length}`);
  } catch (error: any) {
    console.error("❌ Error:", error.response?.data || error.message);
    if (error.response?.data) {
      console.error("Full error:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

test0xSwap();

