/**
 * Debug 0x v2 Permit2 response to understand the data structure
 */

import { getSwapTransaction } from "../lib/0x-swap.js";
import { SEND_TOKEN_ADDRESS } from "../lib/constants.js";
import { USDC_BASE_ADDRESS } from "../lib/0x-swap.js";

const WALLET_ADDRESS = "0x22c21Bb6a4BBe192F8B29551b57a45246530Ad68";
const SEND_AMOUNT = "10000000000000000000"; // 10 SEND

async function debug0xResponse() {
  console.log("\n🔍 Debugging 0x v2 Permit2 Response\n");
  console.log("=".repeat(60));

  const result = await getSwapTransaction(
    SEND_TOKEN_ADDRESS,
    USDC_BASE_ADDRESS,
    SEND_AMOUNT,
    WALLET_ADDRESS,
    1
  );

  if (!result.success) {
    console.error("❌ Failed to get swap:", result.error);
    return;
  }

  console.log("\n📦 Full Response Data:\n");
  console.log(JSON.stringify(result.tx, null, 2));

  console.log("\n" + "=".repeat(60));
  console.log("\n🔑 Key Fields:\n");
  console.log(`to: ${result.tx.to}`);
  console.log(`data length: ${result.tx.data?.length || 0} chars`);
  console.log(`value: ${result.tx.value}`);
  console.log(`buyAmount: ${result.tx.buyAmount}`);
  console.log(`\nHas permit2: ${!!result.tx.permit2}`);
  
  if (result.tx.permit2) {
    console.log(`\n📝 Permit2 Data:`);
    console.log(JSON.stringify(result.tx.permit2, null, 2));
  }

  console.log(`\nHas issues: ${!!result.tx.issues}`);
  if (result.tx.issues) {
    console.log(`Issues:`, JSON.stringify(result.tx.issues, null, 2));
  }

  console.log(`\nallowanceTarget: ${result.tx.allowanceTarget}`);
  console.log("\n");
}

debug0xResponse().catch(console.error);
