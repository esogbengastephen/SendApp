/**
 * Search for SEND token transfers to a wallet address
 * Usage: npx tsx scripts/search-send-transfers.ts <walletAddress>
 */

import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL, SEND_TOKEN_ADDRESS } from "../lib/constants";

const walletAddress = process.argv[2]?.toLowerCase();

if (!walletAddress) {
  console.error("Usage: npx tsx scripts/search-send-transfers.ts <walletAddress>");
  process.exit(1);
}

async function searchSENDTransfers() {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });

  console.log(`\n🔍 Searching for SEND token transfers to: ${walletAddress}\n`);

  try {
    const latestBlock = await publicClient.getBlockNumber();
    console.log(`📦 Latest block: ${latestBlock.toString()}\n`);

    // Search in chunks of 1000 blocks (RPC limit)
    const chunkSize = 1000;
    const maxBlocksToSearch = 50000; // Search last 50k blocks (~1 week)
    const startBlock = latestBlock > BigInt(maxBlocksToSearch) 
      ? latestBlock - BigInt(maxBlocksToSearch) 
      : 0n;

    console.log(`🔍 Searching blocks ${startBlock.toString()} to ${latestBlock.toString()}...\n`);

    // Search for Transfer events where 'to' is our wallet
    // Transfer event signature: Transfer(address indexed from, address indexed to, uint256 value)
    const transferEventSignature = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    
    let allLogs: any[] = [];
    let currentStart = startBlock;
    
    // Search in chunks
    while (currentStart < latestBlock) {
      const currentEnd = currentStart + BigInt(chunkSize);
      const searchEnd = currentEnd > latestBlock ? latestBlock : currentEnd;
      
      try {
        console.log(`   Searching blocks ${currentStart.toString()} to ${searchEnd.toString()}...`);
        
        const logs = await publicClient.getLogs({
          address: SEND_TOKEN_ADDRESS as `0x${string}`,
          fromBlock: currentStart,
          toBlock: searchEnd,
        });

        // Filter logs where 'to' address matches our wallet
        const relevantLogs = logs.filter((log) => {
          // Transfer event has 3 topics: [signature, from, to]
          if (log.topics.length >= 3) {
            const toAddress = `0x${log.topics[2].slice(26)}`.toLowerCase();
            return toAddress === walletAddress;
          }
          return false;
        });

        if (relevantLogs.length > 0) {
          allLogs.push(...relevantLogs);
          console.log(`   ✅ Found ${relevantLogs.length} transfer(s) in this range`);
        } else {
          console.log(`   ⚪ No transfers found`);
        }
      } catch (error: any) {
        console.log(`   ⚠️  Error searching this range: ${error.message}`);
      }

      currentStart = searchEnd + 1n;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n📊 Search Complete\n`);

    if (allLogs.length === 0) {
      console.log(`❌ No SEND token transfers found to this wallet`);
      console.log(`   Searched ${maxBlocksToSearch} blocks (approximately 2 weeks of history)`);
      console.log(`   This means:`);
      console.log(`   1. SEND tokens were never sent to this wallet, OR`);
      console.log(`   2. The transfer happened more than ${maxBlocksToSearch} blocks ago\n`);
      return;
    }

    console.log(`✅ Found ${allLogs.length} SEND token transfer(s) to this wallet:\n`);

    // Decode and display each transfer
    for (let i = 0; i < allLogs.length; i++) {
      const log = allLogs[i];
      const fromAddress = `0x${log.topics[1].slice(26)}`;
      const toAddress = `0x${log.topics[2].slice(26)}`;
      
      // Decode the value from data (it's the last 32 bytes)
      const valueHex = log.data.slice(-64);
      const value = BigInt(`0x${valueHex}`);
      const decimals = 18; // SEND has 18 decimals
      const amount = formatUnits(value, decimals);

      console.log(`Transfer ${i + 1}:`);
      console.log(`   Block: ${log.blockNumber}`);
      console.log(`   Transaction: ${log.transactionHash}`);
      console.log(`   From: ${fromAddress}`);
      console.log(`   To: ${toAddress}`);
      console.log(`   Amount: ${amount} SEND`);
      console.log(`   Raw: ${value.toString()}\n`);

      // Get transaction details
      try {
        const tx = await publicClient.getTransaction({
          hash: log.transactionHash,
        });
        console.log(`   Transaction Details:`);
        console.log(`     From: ${tx.from}`);
        console.log(`     To: ${tx.to || "Contract Creation"}`);
        console.log(`     Value: ${formatUnits(tx.value, 18)} ETH`);
        console.log(`     Gas Used: ${tx.gas.toString()}\n`);
      } catch (error) {
        // Skip if we can't get transaction details
      }
    }

  } catch (error: any) {
    console.error("❌ Error searching transfers:", error.message);
    process.exit(1);
  }
}

searchSENDTransfers();

