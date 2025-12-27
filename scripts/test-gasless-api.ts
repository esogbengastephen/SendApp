/**
 * Test 0x Gasless API (Permit2) for various tokens
 * This script checks if tokens support gasless swaps on Base network
 */

import axios from "axios";
import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, "utf-8");
  envFile.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").replace(/^["']|["']$/g, "");
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

const BASE_CHAIN_ID = 8453;
const ZEROX_API_URL = "https://api.0x.org/swap/permit2";
const ZEROX_API_KEY = process.env.ZEROX_API_KEY;

if (!ZEROX_API_KEY) {
  console.error("❌ ZEROX_API_KEY not found in .env.local");
  console.error("   Please get a free API key from: https://0x.org/pricing");
  process.exit(1);
}

console.log(`✅ 0x API Key loaded: ${ZEROX_API_KEY.substring(0, 8)}...`);

// Token addresses on Base
const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const USDC_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH_TOKEN = "0x4200000000000000000000000000000000000006";

// Test wallet address
const TEST_TAKER = "0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0";

interface GaslessTestResult {
  token: string;
  tokenName: string;
  success: boolean;
  error?: string;
  buyAmount?: string;
  gasEstimate?: string;
  feesIncluded?: boolean;
  permitRequired?: boolean;
  quote?: any;
}

/**
 * Test gasless swap for a specific token
 */
async function testGaslessSwap(
  sellToken: string,
  tokenName: string,
  sellAmount: string
): Promise<GaslessTestResult> {
  try {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Testing: ${tokenName} → USDC (Gasless)`);
    console.log(`${"=".repeat(60)}`);

    const params = {
      chainId: BASE_CHAIN_ID,
      sellToken: sellToken,
      buyToken: USDC_TOKEN,
      sellAmount: sellAmount,
      taker: TEST_TAKER,
      slippagePercentage: 0.01, // 1%
    };

    console.log(`📤 Request params:`, params);

    const response = await axios.get(`${ZEROX_API_URL}/quote`, {
      params,
      headers: {
        "0x-version": "v2",
        "0x-api-key": ZEROX_API_KEY,
      },
      timeout: 10000,
    });

    console.log(`\n✅ SUCCESS - Gasless is supported!`);
    console.log(`📊 Quote Details:`);
    console.log(`   Buy Amount (USDC): ${response.data.buyAmount}`);
    console.log(`   Sell Amount: ${response.data.sellAmount}`);
    
    if (response.data.gas) {
      console.log(`   Gas Estimate: ${response.data.gas}`);
    }
    
    if (response.data.permit2) {
      console.log(`   ✅ Permit2 signature required: YES`);
      console.log(`   Permit2 Type: ${response.data.permit2.type || "standard"}`);
    } else {
      console.log(`   ⚠️  Permit2 signature required: NO`);
    }

    if (response.data.issues) {
      console.log(`   ⚠️  Issues:`, response.data.issues);
    }

    // Calculate effective rate
    const buyAmountFormatted = parseFloat(response.data.buyAmount) / 1e6; // USDC has 6 decimals
    const sellAmountFormatted = parseFloat(sellAmount) / 1e18; // Assuming 18 decimals
    const rate = buyAmountFormatted / sellAmountFormatted;
    console.log(`   Rate: 1 ${tokenName} = ${rate.toFixed(6)} USDC`);

    return {
      token: sellToken,
      tokenName,
      success: true,
      buyAmount: response.data.buyAmount,
      gasEstimate: response.data.gas,
      feesIncluded: true,
      permitRequired: !!response.data.permit2,
      quote: response.data,
    };
  } catch (error: any) {
    console.log(`\n❌ FAILED - Gasless NOT supported`);
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error:`, JSON.stringify(error.response.data, null, 2));
      
      return {
        token: sellToken,
        tokenName,
        success: false,
        error: error.response.data.reason || error.response.data.message || "Unknown error",
      };
    } else if (error.code === "ECONNABORTED") {
      return {
        token: sellToken,
        tokenName,
        success: false,
        error: "Request timeout - API might be slow or unavailable",
      };
    } else {
      console.log(`   Error:`, error.message);
      
      return {
        token: sellToken,
        tokenName,
        success: false,
        error: error.message || "Unknown error",
      };
    }
  }
}

/**
 * Main test function
 */
async function main() {
  console.log(`\n${"#".repeat(60)}`);
  console.log(`🧪 Testing 0x Gasless API (Permit2) on Base Network`);
  console.log(`${"#".repeat(60)}\n`);
  console.log(`API Endpoint: ${ZEROX_API_URL}`);
  console.log(`Chain ID: ${BASE_CHAIN_ID} (Base Mainnet)`);
  console.log(`Test Taker: ${TEST_TAKER}\n`);

  const results: GaslessTestResult[] = [];

  // Test 1: SEND token (1 SEND = 1e18)
  console.log(`\n📝 Test 1: SEND Token`);
  const sendResult = await testGaslessSwap(
    SEND_TOKEN,
    "SEND",
    "1000000000000000000" // 1 SEND
  );
  results.push(sendResult);

  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s between requests

  // Test 2: WETH (0.001 WETH = 1e15)
  console.log(`\n📝 Test 2: WETH Token`);
  const wethResult = await testGaslessSwap(
    WETH_TOKEN,
    "WETH",
    "1000000000000000" // 0.001 WETH
  );
  results.push(wethResult);

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Native ETH (0.001 ETH)
  console.log(`\n📝 Test 3: Native ETH`);
  const ethResult = await testGaslessSwap(
    "ETH", // 0x uses "ETH" for native token
    "ETH",
    "1000000000000000" // 0.001 ETH
  );
  results.push(ethResult);

  // Summary
  console.log(`\n\n${"#".repeat(60)}`);
  console.log(`📊 SUMMARY - Gasless Support Results`);
  console.log(`${"#".repeat(60)}\n`);

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Supported: ${successCount}`);
  console.log(`❌ Not Supported: ${failCount}\n`);

  console.log(`Detailed Results:\n`);
  
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.tokenName} (${result.token}):`);
    if (result.success) {
      console.log(`   ✅ Gasless: SUPPORTED`);
      console.log(`   📝 Permit2 Required: ${result.permitRequired ? "YES" : "NO"}`);
      console.log(`   💰 Output: ${result.buyAmount} (raw USDC)`);
    } else {
      console.log(`   ❌ Gasless: NOT SUPPORTED`);
      console.log(`   📝 Error: ${result.error}`);
    }
    console.log();
  });

  // Recommendations
  console.log(`\n${"#".repeat(60)}`);
  console.log(`💡 RECOMMENDATIONS`);
  console.log(`${"#".repeat(60)}\n`);

  if (sendResult.success) {
    console.log(`✅ GREAT NEWS! SEND token supports gasless swaps!`);
    console.log(`   → You can implement the hybrid gasless system`);
    console.log(`   → This will save ~$0.60 per SEND swap (no ETH gas needed)`);
    console.log(`   → Fees will be deducted from output USDC automatically`);
  } else {
    console.log(`❌ SEND token does NOT support gasless swaps`);
    console.log(`   → Likely reason: ${sendResult.error}`);
    console.log(`   → Recommendation: Keep current system (0x → Aerodrome fallback)`);
    console.log(`   → You can still implement gasless for OTHER tokens (WETH, USDC, etc.)`);
    console.log(`   → Hybrid approach: Try gasless first, fallback to traditional for SEND`);
  }

  console.log(`\n${"=".repeat(60)}\n`);
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
