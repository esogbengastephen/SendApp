/**
 * Test Hybrid Gasless System
 * This script tests all 3 layers of the cascading fallback system
 */

import { getSmartSwapTransaction } from "../lib/smart-swap";

const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const USDC_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH_TOKEN = "0x4200000000000000000000000000000000000006";
const TEST_ADDRESS = "0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0";

async function testSwapRouting(
  tokenAddress: string,
  tokenName: string,
  amount: string
) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Testing: ${tokenName} → USDC`);
  console.log(`${"=".repeat(70)}`);

  try {
    const result = await getSmartSwapTransaction(
      tokenAddress,
      USDC_TOKEN,
      amount,
      TEST_ADDRESS,
      1
    );

    if (result.success) {
      console.log(`\n✅ SUCCESS!`);
      console.log(`   Provider: ${result.provider}`);
      console.log(`   Layer Used: ${result.layerUsed}`);
      console.log(`   Gas Required: ${result.gasRequired ? "YES" : "NO"}`);
      console.log(`   Buy Amount: ${result.tx?.buyAmount || result.tx?.dstAmount}`);
      
      if (result.provider === "0x-gasless") {
        console.log(`   💰 Estimated Savings: ~$0.60 (no ETH gas needed)`);
        console.log(`   📝 Requires: Permit2 signature (off-chain)`);
      } else {
        console.log(`   💰 Cost: ~$0.60 (ETH gas required)`);
        console.log(`   📝 Requires: ETH funding + approval + swap`);
      }
    } else {
      console.log(`\n❌ FAILED`);
      console.log(`   Error: ${result.error}`);
    }
  } catch (error: any) {
    console.log(`\n❌ ERROR`);
    console.log(`   ${error.message}`);
  }
}

async function main() {
  console.log(`\n${"#".repeat(70)}`);
  console.log(`🧪 Testing 3-Layer Hybrid Gasless System`);
  console.log(`${"#".repeat(70)}\n`);
  console.log(`This will test the cascading fallback system:`);
  console.log(`   Layer 1: 0x Gasless (Permit2) - No gas`);
  console.log(`   Layer 2: 0x Traditional - Requires gas`);
  console.log(`   Layer 3: Aerodrome - Requires gas\n`);

  // Test 1: SEND token (1 SEND)
  await testSwapRouting(
    SEND_TOKEN,
    "SEND",
    "1000000000000000000" // 1 SEND
  );

  await new Promise(r => setTimeout(r, 2000));

  // Test 2: WETH (0.001 WETH)
  await testSwapRouting(
    WETH_TOKEN,
    "WETH",
    "1000000000000000" // 0.001 WETH
  );

  console.log(`\n${"#".repeat(70)}`);
  console.log(`📊 Test Complete`);
  console.log(`${"#".repeat(70)}\n`);
  console.log(`Next Steps:`);
  console.log(`1. Review results above`);
  console.log(`2. If gasless works for SEND, deployment is ready!`);
  console.log(`3. Test end-to-end swap in development environment`);
  console.log(`4. Monitor first production swaps closely`);
  console.log(`5. Track cost savings over time\n`);
}

main().catch(console.error);
