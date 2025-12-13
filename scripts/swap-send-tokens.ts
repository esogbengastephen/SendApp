/**
 * Script to find transaction by wallet and trigger swap
 * This will check the wallet, find the transaction, and trigger the swap
 */

import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL, SEND_TOKEN_ADDRESS } from "../lib/constants";

const walletAddress = "0xCadCda9Ae9f84B865c18dF5af43E60CaE0b31A52";

async function checkWalletAndTriggerSwap() {
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
      ] as const,
      functionName: "balanceOf",
      args: [walletAddress as `0x${string}`],
    })) as bigint;

    const decimals = 18; // SEND token has 18 decimals
    const balanceFormatted = formatUnits(balance, decimals);

    console.log(`📊 SEND Token Balance: ${balanceFormatted} SEND`);
    console.log(`📊 Raw Balance: ${balance.toString()}\n`);

    if (balance === BigInt(0)) {
      console.log("❌ No SEND tokens found in this wallet");
      console.log("💡 Please verify:");
      console.log("   1. The wallet address is correct");
      console.log("   2. Tokens were sent to this address");
      console.log("   3. The transaction has been confirmed on Base network\n");
      return;
    }

    console.log(`✅ Found ${balanceFormatted} SEND tokens!\n`);
    console.log("📝 Next steps:");
    console.log("   1. Find the transaction ID in the database for this wallet");
    console.log("   2. Call /api/offramp/check-token with the transaction ID");
    console.log("   3. Then call /api/offramp/swap-token to trigger the swap\n");
    console.log(`💡 You can use the admin dashboard to find the transaction and trigger the swap\n`);

  } catch (error: any) {
    console.error("❌ Error checking wallet:", error.message);
    if (error.message?.includes("Contract")) {
      console.error("   This might mean the token contract address is incorrect");
    }
  }
}

checkWalletAndTriggerSwap();

