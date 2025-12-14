/**
 * Test swap API with a known liquid pair (WETH -> USDC) to verify API is working
 */

import axios from "axios";

const BASE_CHAIN_ID = 8453;
const ZEROX_API_URL = "https://api.0x.org/swap/v1";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // WETH on Base
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TEST_WALLET = "0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2";
const TEST_AMOUNT = "100000000000000000"; // 0.1 WETH (18 decimals)

async function testWorkingPair() {
  console.log("\n🧪 Testing Swap API with WETH -> USDC (known liquid pair)...\n");
  console.log("=" .repeat(60));
  console.log(`Sell Token: WETH (${WETH_ADDRESS})`);
  console.log(`Buy Token: USDC (${USDC_ADDRESS})`);
  console.log(`Amount: ${TEST_AMOUNT} (0.1 WETH)\n`);
  console.log("=" .repeat(60) + "\n");

  try {
    const quoteResponse = await axios.get(`${ZEROX_API_URL}/quote`, {
      params: {
        sellToken: WETH_ADDRESS,
        buyToken: USDC_ADDRESS,
        sellAmount: TEST_AMOUNT,
        takerAddress: TEST_WALLET,
        slippagePercentage: 1,
        chainId: BASE_CHAIN_ID,
      },
    });

    if (quoteResponse.data) {
      console.log("✅ Quote successful! API is working.\n");
      console.log(`   Buy Amount: ${quoteResponse.data.buyAmount}`);
      console.log(`   Estimated USDC: ${parseFloat(quoteResponse.data.buyAmount) / 1e6} USDC`);
      console.log(`   Price: ${quoteResponse.data.price || "N/A"}\n`);
      
      // Test swap endpoint
      console.log("🔄 Testing /swap endpoint...\n");
      const swapResponse = await axios.get(`${ZEROX_API_URL}/swap`, {
        params: {
          sellToken: WETH_ADDRESS,
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
        console.log(`   Data length: ${swapResponse.data.data?.length || 0} bytes\n`);
        console.log("=" .repeat(60));
        console.log("\n✅ CONCLUSION: Swap API is working correctly!");
        console.log("   The issue with SEND -> USDC is likely due to:");
        console.log("   - SEND token has no liquidity on Base");
        console.log("   - No trading pair available for SEND/USDC\n");
      }
    }
  } catch (error: any) {
    console.error("❌ Error:", error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.error("   Details:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

testWorkingPair();


