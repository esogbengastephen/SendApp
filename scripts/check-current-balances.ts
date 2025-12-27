/**
 * Check current SEND and USDC balances and verify transaction
 */

import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL, SEND_TOKEN_ADDRESS } from "../lib/constants.js";
import { USDC_BASE_ADDRESS as USDC_ADDRESS } from "../lib/0x-swap.js";

const WALLET_ADDRESS = "0x22c21Bb6a4BBe192F8B29551b57a45246530Ad68";
const TX_HASH = "0x1e1efd7797168ea9a4bb70889b4a41aa2e804127e6bfe819b29f0a46c8375ddc";

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

async function checkBalances() {
  console.log("\n📊 Checking Current Balances\n");
  console.log("=".repeat(60));
  console.log(`Wallet: ${WALLET_ADDRESS}`);
  console.log("=".repeat(60) + "\n");

  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });

  // Check SEND balance
  const sendBalance = await publicClient.readContract({
    address: SEND_TOKEN_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [WALLET_ADDRESS as `0x${string}`],
  }) as bigint;

  const sendDecimals = await publicClient.readContract({
    address: SEND_TOKEN_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "decimals",
  }) as number;

  const sendBalanceFormatted = formatUnits(sendBalance, sendDecimals);

  // Check USDC balance
  const usdcBalance = await publicClient.readContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [WALLET_ADDRESS as `0x${string}`],
  }) as bigint;

  const usdcBalanceFormatted = formatUnits(usdcBalance, 6);

  console.log(`SEND Balance: ${sendBalanceFormatted} SEND`);
  console.log(`USDC Balance: ${usdcBalanceFormatted} USDC\n`);

  // Check transaction receipt
  console.log("=".repeat(60));
  console.log(`Checking Transaction: ${TX_HASH}`);
  console.log("=".repeat(60) + "\n");

  try {
    const receipt = await publicClient.getTransactionReceipt({
      hash: TX_HASH as `0x${string}`,
    });

    console.log(`Status: ${receipt.status === "success" ? "✅ SUCCESS" : "❌ FAILED"}`);
    console.log(`Block Number: ${receipt.blockNumber.toString()}`);
    console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`Logs Count: ${receipt.logs.length}\n`);

    if (receipt.status === "success") {
      // Transfer event signature
      const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
      
      const transferLogs = receipt.logs.filter(log => log.topics[0] === TRANSFER_TOPIC);
      
      console.log(`Found ${transferLogs.length} Transfer events:\n`);

      for (let i = 0; i < transferLogs.length; i++) {
        const log = transferLogs[i];
        const tokenAddress = log.address.toLowerCase();
        
        if (tokenAddress === SEND_TOKEN_ADDRESS.toLowerCase()) {
          const amount = BigInt(log.data);
          console.log(`${i + 1}. SEND Transfer: ${formatUnits(amount, sendDecimals)} SEND`);
          console.log(`   From: ${log.topics[1] ? `0x${log.topics[1].slice(26)}` : "unknown"}`);
          console.log(`   To: ${log.topics[2] ? `0x${log.topics[2].slice(26)}` : "unknown"}`);
        } else if (tokenAddress === USDC_ADDRESS.toLowerCase()) {
          const amount = BigInt(log.data);
          console.log(`${i + 1}. USDC Transfer: ${formatUnits(amount, 6)} USDC`);
          console.log(`   From: ${log.topics[1] ? `0x${log.topics[1].slice(26)}` : "unknown"}`);
          console.log(`   To: ${log.topics[2] ? `0x${log.topics[2].slice(26)}` : "unknown"}`);
        } else {
          console.log(`${i + 1}. Other token: ${log.address}`);
        }
        console.log();
      }

      // Summary
      console.log("=".repeat(60));
      const sendTransfers = transferLogs.filter(log => log.address.toLowerCase() === SEND_TOKEN_ADDRESS.toLowerCase());
      const usdcTransfers = transferLogs.filter(log => log.address.toLowerCase() === USDC_ADDRESS.toLowerCase());
      
      if (sendTransfers.length > 0 && usdcTransfers.length > 0) {
        console.log("✅ Transaction completed successfully!");
        console.log("✅ SEND tokens were transferred");
        console.log("✅ USDC tokens were received");
        console.log("\n💡 If your balance shows 100 SEND, the swap may not have completed.");
        console.log("   Check the transaction on BaseScan for details:");
        console.log(`   https://basescan.org/tx/${TX_HASH}`);
      } else if (sendTransfers.length === 0) {
        console.log("⚠️  No SEND transfers found in transaction");
        console.log("❌ The swap may have failed or not executed");
      }
    } else {
      console.log("\n❌ Transaction failed on-chain");
    }

  } catch (error: any) {
    console.error("\n❌ Error checking transaction:", error.message);
  }

  console.log("\n");
}

checkBalances().catch(console.error);
