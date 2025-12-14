/**
 * Check swap transaction details on-chain
 * Usage: npx tsx scripts/check-swap-transaction.ts <txHash>
 */

import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL } from "../lib/constants";

const txHash = process.argv[2];

if (!txHash) {
  console.error("Usage: npx tsx scripts/check-swap-transaction.ts <txHash>");
  process.exit(1);
}

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base

async function checkSwapTransaction() {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });

  console.log(`\n🔍 Checking swap transaction: ${txHash}\n`);

  try {
    // Get transaction receipt
    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    console.log("📊 Transaction Receipt:");
    console.log(`   Status: ${receipt.status === "success" ? "✅ Success" : "❌ Failed"}`);
    console.log(`   Block Number: ${receipt.blockNumber}`);
    console.log(`   From: ${receipt.from}`);
    console.log(`   To: ${receipt.to}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
    console.log("");

    // Get transaction details
    const tx = await publicClient.getTransaction({
      hash: txHash as `0x${string}`,
    });

    console.log("📊 Transaction Details:");
    console.log(`   Value: ${formatUnits(tx.value, 18)} ETH`);
    console.log(`   Gas Price: ${formatUnits(tx.gasPrice || BigInt(0), 9)} Gwei`);
    console.log("");

    // Check logs for USDC transfers
    console.log("📊 Transaction Logs (looking for USDC transfers):");
    const usdcTransferLogs = receipt.logs.filter((log) => 
      log.address.toLowerCase() === USDC_ADDRESS.toLowerCase()
    );

    if (usdcTransferLogs.length > 0) {
      console.log(`   ✅ Found ${usdcTransferLogs.length} USDC-related log(s)`);
      usdcTransferLogs.forEach((log, i) => {
        console.log(`   Log ${i + 1}:`);
        console.log(`     Address: ${log.address}`);
        console.log(`     Topics: ${log.topics.length} topic(s)`);
        // USDC Transfer event signature: Transfer(address indexed from, address indexed to, uint256 value)
        if (log.topics.length >= 3) {
          const from = `0x${log.topics[1].slice(26)}`;
          const to = `0x${log.topics[2].slice(26)}`;
          const value = BigInt(log.data);
          console.log(`     From: ${from}`);
          console.log(`     To: ${to}`);
          console.log(`     Amount: ${formatUnits(value, 6)} USDC`);
        }
        console.log("");
      });
    } else {
      console.log(`   ⚠️  No USDC transfer logs found in this transaction`);
      console.log(`   This might mean:`);
      console.log(`     1. The swap failed`);
      console.log(`     2. USDC was not transferred`);
      console.log(`     3. The transaction is for a different token`);
      console.log("");
    }

    // Check all logs
    console.log(`📊 Total Logs: ${receipt.logs.length}`);
    if (receipt.logs.length > 0) {
      console.log(`   First few logs:`);
      receipt.logs.slice(0, 5).forEach((log, i) => {
        console.log(`   Log ${i + 1}: ${log.address} (${log.topics.length} topics)`);
      });
    }

  } catch (error: any) {
    console.error("❌ Error checking transaction:", error.message);
    if (error.message?.includes("not found")) {
      console.error("   Transaction not found on Base network. It may have failed or not been broadcast.");
    }
    process.exit(1);
  }
}

checkSwapTransaction();

