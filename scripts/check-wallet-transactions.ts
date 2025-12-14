/**
 * Check all transactions for a wallet to see if SEND tokens were ever received
 * Usage: npx tsx scripts/check-wallet-transactions.ts <walletAddress>
 */

import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL, SEND_TOKEN_ADDRESS } from "../lib/constants";

const walletAddress = process.argv[2];

if (!walletAddress) {
  console.error("Usage: npx tsx scripts/check-wallet-transactions.ts <walletAddress>");
  process.exit(1);
}

async function checkWalletTransactions() {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });

  console.log(`\n🔍 Checking wallet transactions: ${walletAddress}\n`);

  try {
    // Check current SEND token balance
    const balance = (await publicClient.readContract({
      address: SEND_TOKEN_ADDRESS as `0x${string}`,
      abi: [
        {
          constant: true,
          inputs: [{ name: "_owner", type: "address" }],
          name: "balanceOf",
          outputs: [{ name: "", type: "uint256" }],
          type: "function",
        },
        {
          constant: true,
          inputs: [],
          name: "decimals",
          outputs: [{ name: "", type: "uint8" }],
          type: "function",
        },
      ] as const,
      functionName: "balanceOf",
      args: [walletAddress as `0x${string}`],
    })) as bigint;

    const decimals = (await publicClient.readContract({
      address: SEND_TOKEN_ADDRESS as `0x${string}`,
      abi: [
        {
          constant: true,
          inputs: [],
          name: "decimals",
          outputs: [{ name: "", type: "uint8" }],
          type: "function",
        },
      ] as const,
      functionName: "decimals",
    })) as number;

    const balanceFormatted = formatUnits(balance, decimals);

    console.log(`📊 Current SEND Token Balance: ${balanceFormatted} SEND`);
    console.log(`📊 Raw Balance: ${balance.toString()}\n`);

    if (balance > BigInt(0)) {
      console.log(`✅ Found ${balanceFormatted} SEND tokens in wallet!\n`);
      return;
    }

    // If balance is 0, check transaction history
    console.log(`⚠️  Current balance is 0. Checking if SEND tokens were ever received...\n`);

    // Get recent blocks to search
    const latestBlock = await publicClient.getBlockNumber();
    console.log(`📦 Latest block: ${latestBlock.toString()}`);
    console.log(`🔍 Searching last 1000 blocks for SEND token transfers...\n`);

    // Search for Transfer events from SEND token contract
    // Transfer(address indexed from, address indexed to, uint256 value)
    const transferEventSignature = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    
    // Search backwards from latest block
    const searchBlocks = 1000;
    const startBlock = latestBlock - BigInt(searchBlocks);
    
    try {
      const logs = await publicClient.getLogs({
        address: SEND_TOKEN_ADDRESS as `0x${string}`,
        event: {
          type: "event",
          name: "Transfer",
          inputs: [
            { type: "address", indexed: true, name: "from" },
            { type: "address", indexed: true, name: "to" },
            { type: "uint256", indexed: false, name: "value" },
          ],
        } as any,
        args: {
          to: walletAddress as `0x${string}`,
        } as any,
        fromBlock: startBlock > 0n ? startBlock : 0n,
        toBlock: latestBlock,
      });

      if (logs.length > 0) {
        console.log(`✅ Found ${logs.length} SEND token transfer(s) to this wallet:\n`);
        logs.forEach((log, i) => {
          console.log(`Transfer ${i + 1}:`);
          console.log(`   Block: ${log.blockNumber}`);
          console.log(`   Transaction: ${log.transactionHash}`);
          console.log(`   From: ${(log.args as any).from}`);
          console.log(`   To: ${(log.args as any).to}`);
          const value = (log.args as any).value;
          console.log(`   Amount: ${formatUnits(value, decimals)} SEND`);
          console.log(`   Raw: ${value.toString()}\n`);
        });
      } else {
        console.log(`❌ No SEND token transfers found in the last ${searchBlocks} blocks`);
        console.log(`   This means:`);
        console.log(`   1. SEND tokens were never sent to this wallet, OR`);
        console.log(`   2. The transfer happened more than ${searchBlocks} blocks ago`);
        console.log(`   3. The tokens were sent to a different address\n`);
      }
    } catch (error: any) {
      console.log(`⚠️  Could not search transaction history: ${error.message}`);
      console.log(`   This might be due to RPC limitations or the search range being too large\n`);
    }

    // Also check ETH balance
    const ethBalance = await publicClient.getBalance({
      address: walletAddress as `0x${string}`,
    });
    console.log(`⛽ ETH Balance: ${formatUnits(ethBalance, 18)} ETH\n`);

  } catch (error: any) {
    console.error("❌ Error checking wallet:", error.message);
    if (error.message?.includes("Contract")) {
      console.error("   This might mean the token contract address is incorrect");
    }
    process.exit(1);
  }
}

checkWalletTransactions();

