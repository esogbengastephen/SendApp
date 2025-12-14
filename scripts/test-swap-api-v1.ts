/**
 * Test the swap API using v1 endpoints (no API key required for basic testing)
 */

import axios from "axios";

const BASE_CHAIN_ID = 8453;
const ZEROX_API_URL_V1 = "https://api.0x.org/swap/v1"; // v1 endpoint (may not require API key)
const SEND_TOKEN_ADDRESS = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TEST_WALLET = "0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2";
const TEST_AMOUNT = "100000000000000000000"; // 100 SEND

async function testSwapAPIV1() {
  console.log("\n🧪 Testing Swap API (v1 endpoint)...\n");
  console.log("=" .repeat(60));
  console.log(`Test Wallet: ${TEST_WALLET}`);
  console.log(`Sell Token: ${SEND_TOKEN_ADDRESS}`);
  console.log(`Buy Token: ${USDC_ADDRESS}`);
  console.log(`Amount: ${TEST_AMOUNT} (100 SEND)\n`);
  console.log("=" .repeat(60) + "\n");

  // Test quote endpoint
  console.log("📊 Testing /quote endpoint...\n");
  try {
    const quoteResponse = await axios.get(`${ZEROX_API_URL_V1}/quote`, {
      params: {
        sellToken: SEND_TOKEN_ADDRESS,
        buyToken: USDC_ADDRESS,
        sellAmount: TEST_AMOUNT,
        takerAddress: TEST_WALLET,
        slippagePercentage: 1,
        chainId: BASE_CHAIN_ID,
      },
    });

    if (quoteResponse.data) {
      console.log("✅ Quote successful!");
      console.log(`   Buy Amount: ${quoteResponse.data.buyAmount}`);
      console.log(`   Estimated USDC: ${parseFloat(quoteResponse.data.buyAmount) / 1e6} USDC`);
      console.log(`   Price: ${quoteResponse.data.price || "N/A"}\n`);
    }
  } catch (error: any) {
    console.error("❌ Quote failed:", error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.error("   Error details:", JSON.stringify(error.response.data, null, 2));
    }
    console.log();
  }

  // Test swap endpoint
  console.log("🔄 Testing /swap endpoint...\n");
  try {
    const swapResponse = await axios.get(`${ZEROX_API_URL_V1}/swap`, {
      params: {
        sellToken: SEND_TOKEN_ADDRESS,
        buyToken: USDC_ADDRESS,
        sellAmount: TEST_AMOUNT,
        takerAddress: TEST_WALLET,
        slippagePercentage: 1,
        chainId: BASE_CHAIN_ID,
      },
    });

    if (swapResponse.data) {
      console.log("✅ Swap transaction data received!");
      console.log(`   To: ${swapResponse.data.to}`);
      console.log(`   Data length: ${swapResponse.data.data?.length || 0} bytes`);
      console.log(`   Value: ${swapResponse.data.value || "0"} wei`);
      console.log(`   Buy Amount: ${swapResponse.data.buyAmount || "N/A"}\n`);
      console.log("✅ Swap API (v1) is working!\n");
    }
  } catch (error: any) {
    console.error("❌ Swap failed:", error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.error("   Error details:", JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log("=" .repeat(60));
}

testSwapAPIV1();


