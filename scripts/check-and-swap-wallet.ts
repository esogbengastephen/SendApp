/**
 * Script to check wallet balance and trigger swap
 * Usage: npx tsx scripts/check-and-swap-wallet.ts <walletAddress>
 */

import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL, SEND_TOKEN_ADDRESS } from "../lib/constants";

const walletAddress = process.argv[2];

if (!walletAddress) {
  console.error("Usage: npx tsx scripts/check-and-swap-wallet.ts <walletAddress>");
  process.exit(1);
}

async function checkAndSwap() {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });

  console.log(`\n🔍 Checking wallet: ${walletAddress}\n`);

  // Check SEND token balance
  try {
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

    console.log(`📊 SEND Token Balance: ${balanceFormatted} SEND`);
    console.log(`📊 Raw Balance: ${balance.toString()}`);

    if (balance === BigInt(0)) {
      console.log("❌ No SEND tokens found in this wallet");
      process.exit(0);
    }

    // Check ETH balance for gas
    const ethBalance = await publicClient.getBalance({
      address: walletAddress as `0x${string}`,
    });

    console.log(`⛽ ETH Balance: ${formatUnits(ethBalance, 18)} ETH`);

    if (ethBalance < BigInt("200000000000000")) {
      console.log("⚠️  Warning: Low ETH balance. May need gas for swap.");
    }

    console.log(`\n✅ Wallet has ${balanceFormatted} SEND tokens ready to swap\n`);
    console.log("💡 Next step: Find the transaction ID and trigger swap via API\n");

  } catch (error) {
    console.error("❌ Error checking wallet:", error);
    process.exit(1);
  }
}

checkAndSwap();

