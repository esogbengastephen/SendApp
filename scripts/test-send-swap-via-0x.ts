/**
 * Test SEND → USDC swap using 0x (which routes through Aerodrome)
 */

import { createWalletClient, createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { BASE_RPC_URL, SEND_TOKEN_ADDRESS } from "../lib/constants.js";
import { USDC_BASE_ADDRESS as USDC_ADDRESS, executeZeroXSwapWithPermit2 } from "../lib/0x-swap.js";

const WALLET_ADDRESS = "0x22c21Bb6a4BBe192F8B29551b57a45246530Ad68";

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

async function testSendSwap() {
  console.log("\n🧪 Testing SEND → USDC Swap via 0x (routes through Aerodrome)\n");
  console.log("=".repeat(60));
  console.log(`Wallet: ${WALLET_ADDRESS}`);
  console.log(`SEND: ${SEND_TOKEN_ADDRESS}`);
  console.log(`USDC: ${USDC_ADDRESS}`);
  console.log("=".repeat(60) + "\n");

  const privateKey = process.env.OFFRAMP_MASTER_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ OFFRAMP_MASTER_WALLET_PRIVATE_KEY not found");
    return;
  }

  try {
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    
    const publicClient = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    console.log("✅ Connected\n");

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
    console.log(`📊 SEND Balance: ${sendBalanceFormatted} SEND`);

    if (sendBalance === BigInt(0)) {
      console.error("\n❌ No SEND tokens!");
      return;
    }

    // Check USDC before
    const usdcBefore = await publicClient.readContract({
      address: USDC_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [WALLET_ADDRESS as `0x${string}`],
    }) as bigint;

    console.log(`📊 USDC Before: ${formatUnits(usdcBefore, 6)} USDC\n`);

    // Swap 10 SEND
    const swapAmount = BigInt("10000000000000000000"); // 10 SEND

    console.log(`🔄 Swapping 10 SEND → USDC via 0x with Permit2...\n`);

    const swapResult = await executeZeroXSwapWithPermit2(
      SEND_TOKEN_ADDRESS,
      USDC_ADDRESS,
      swapAmount.toString(),
      walletClient,
      publicClient,
      1
    );

    if (!swapResult.success) {
      console.error(`\n❌ Swap failed:`, swapResult.error);
      return;
    }

    console.log(`\n✅ Swap successful!`);
    console.log(`📝 Transaction: ${swapResult.txHash}`);
    console.log(`🔗 BaseScan: https://basescan.org/tx/${swapResult.txHash}`);
    console.log(`💰 USDC Received: ${formatUnits(BigInt(swapResult.buyAmount || "0"), 6)} USDC\n`);

    // Check USDC after
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const usdcAfter = await publicClient.readContract({
      address: USDC_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [WALLET_ADDRESS as `0x${string}`],
    }) as bigint;

    const sendAfter = await publicClient.readContract({
      address: SEND_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [WALLET_ADDRESS as `0x${string}`],
    }) as bigint;

    const usdcGained = formatUnits(usdcAfter - usdcBefore, 6);
    const sendSpent = formatUnits(sendBalance - sendAfter, sendDecimals);
    
    console.log("\n" + "=".repeat(60));
    console.log("📊 Final Balances:");
    console.log("=".repeat(60));
    console.log(`SEND: ${formatUnits(sendAfter, sendDecimals)} SEND (-${sendSpent} SEND)`);
    console.log(`USDC: ${formatUnits(usdcAfter, 6)} USDC (+${usdcGained} USDC)`);

    console.log("\n" + "=".repeat(60));
    console.log("🎉 SUCCESS!");
    console.log("=".repeat(60));
    console.log(`✅ 0x v2 with Permit2 working`);
    console.log(`✅ SEND successfully swapped to USDC`);
    console.log(`✅ Routed through Aerodrome automatically\n`);

  } catch (error: any) {
    console.error("\n❌ Error:", error.message || error);
  }
}

testSendSwap();
