/**
 * Test alternative swap routes for SEND token
 * Tests if we can swap SEND -> WETH -> USDC
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
const SEND_TOKEN_ADDRESS = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const walletAddress = "0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2";
const sellAmount = "100000000000000000000"; // 100 SEND

const headers: Record<string, string> = {};
if (ZEROX_API_KEY) {
  headers["0x-api-key"] = ZEROX_API_KEY;
}

async function testRoutes() {
  console.log("Testing alternative swap routes...\n");

  // Test 1: SEND -> WETH
  console.log("1. Testing SEND -> WETH...");
  try {
    const response = await axios.get(`${ZEROX_API_URL}/quote`, {
      params: {
        sellToken: SEND_TOKEN_ADDRESS.toLowerCase(),
        buyToken: WETH_ADDRESS.toLowerCase(),
        sellAmount: sellAmount,
        takerAddress: walletAddress.toLowerCase(),
        slippagePercentage: 0.01,
        chainId: 8453,
      },
      headers,
    });
    console.log("✅ SEND -> WETH route exists!");
    console.log(`   Buy Amount: ${response.data.buyAmount} WETH\n`);
  } catch (error: any) {
    console.log("❌ SEND -> WETH route not found");
    console.log(`   Error: ${error.response?.data?.message || error.message}\n`);
  }

  // Test 2: WETH -> USDC
  console.log("2. Testing WETH -> USDC...");
  try {
    const wethAmount = "100000000000000000"; // 0.1 WETH for testing
    const response = await axios.get(`${ZEROX_API_URL}/quote`, {
      params: {
        sellToken: WETH_ADDRESS.toLowerCase(),
        buyToken: USDC_ADDRESS.toLowerCase(),
        sellAmount: wethAmount,
        takerAddress: walletAddress.toLowerCase(),
        slippagePercentage: 0.01,
        chainId: 8453,
      },
      headers,
    });
    console.log("✅ WETH -> USDC route exists!");
    console.log(`   Buy Amount: ${response.data.buyAmount} USDC\n`);
  } catch (error: any) {
    console.log("❌ WETH -> USDC route not found");
    console.log(`   Error: ${error.response?.data?.message || error.message}\n`);
  }

  // Test 3: Direct SEND -> USDC (already known to fail, but confirming)
  console.log("3. Testing SEND -> USDC (direct)...");
  try {
    const response = await axios.get(`${ZEROX_API_URL}/quote`, {
      params: {
        sellToken: SEND_TOKEN_ADDRESS.toLowerCase(),
        buyToken: USDC_ADDRESS.toLowerCase(),
        sellAmount: sellAmount,
        takerAddress: walletAddress.toLowerCase(),
        slippagePercentage: 0.01,
        chainId: 8453,
      },
      headers,
    });
    console.log("✅ SEND -> USDC route exists!");
    console.log(`   Buy Amount: ${response.data.buyAmount} USDC\n`);
  } catch (error: any) {
    console.log("❌ SEND -> USDC route not found (as expected)");
    console.log(`   Error: ${error.response?.data?.message || error.message}\n`);
  }
}

testRoutes();

