/**
 * Check USDC balance for a wallet address
 * Usage: npx tsx scripts/check-usdc-balance.ts <walletAddress>
 */

import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL } from "../lib/constants";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
const walletAddress = process.argv[2];

if (!walletAddress) {
  console.error("Usage: npx tsx scripts/check-usdc-balance.ts <walletAddress>");
  process.exit(1);
}

async function checkUSDCBalance() {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });

  console.log(`\n🔍 Checking USDC balance for: ${walletAddress}\n`);

  try {
    const balance = (await publicClient.readContract({
      address: USDC_ADDRESS as `0x${string}`,
      abi: [
        {
          constant: true,
          inputs: [{ name: "_owner", type: "address" }],
          name: "balanceOf",
          outputs: [{ name: "", type: "uint256" }],
          type: "function",
        },
      ] as const,
      functionName: "balanceOf",
      args: [walletAddress as `0x${string}`],
    })) as bigint;

    const balanceFormatted = formatUnits(balance, 6); // USDC has 6 decimals

    console.log(`📊 USDC Balance: ${balanceFormatted} USDC`);
    console.log(`📊 Raw Balance: ${balance.toString()}\n`);

    if (balance === BigInt(0)) {
      console.log("❌ No USDC found in this wallet\n");
    } else {
      console.log(`✅ Found ${balanceFormatted} USDC in this wallet\n`);
    }
  } catch (error: any) {
    console.error("❌ Error checking USDC balance:", error.message);
    process.exit(1);
  }
}

checkUSDCBalance();

