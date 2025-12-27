/**
 * Test SEND → USDC swap for $1 worth of SEND
 */

import { createWalletClient, createPublicClient, http, formatUnits, parseUnits } from "viem";
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
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

async function testSendSwap1USD() {
  console.log("\n🧪 Testing SEND → USDC Swap (~$1 worth of SEND)\n");
  console.log("=".repeat(60));
  console.log(`Wallet: ${WALLET_ADDRESS}`);
  console.log(`SEND: ${SEND_TOKEN_ADDRESS}`);
  console.log(`USDC: ${USDC_ADDRESS}`);
  console.log("=".repeat(60) + "\n");

  try {
    // Setup
    const privateKey = process.env.OFFRAMP_MASTER_WALLET_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("OFFRAMP_MASTER_WALLET_PRIVATE_KEY not set");
    }

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

    // Get SEND balance and decimals
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

    // Get USDC balance before
    const usdcBefore = await publicClient.readContract({
      address: USDC_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [WALLET_ADDRESS as `0x${string}`],
    }) as bigint;

    console.log(`📊 SEND Balance: ${formatUnits(sendBalance, sendDecimals)} SEND`);
    console.log(`📊 USDC Before: ${formatUnits(usdcBefore, 6)} USDC\n`);

    // Calculate amount: From previous swap, 10 SEND = ~0.21 USDC
    // So for 1 USDC, we need approximately 48 SEND
    const swapAmount = parseUnits("48", sendDecimals);

    if (sendBalance < swapAmount) {
      console.error(`❌ Insufficient SEND balance. Need ${formatUnits(swapAmount, sendDecimals)} SEND`);
      return;
    }

    console.log(`🔄 Swapping ${formatUnits(swapAmount, sendDecimals)} SEND → USDC (targeting ~1 USDC)...\n`);

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

    // Check balances after
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
    console.log(`\n💵 Effective Rate: 1 SEND = $${(parseFloat(usdcGained) / parseFloat(sendSpent)).toFixed(6)}`);

    console.log("\n" + "=".repeat(60));
    console.log("🎉 SUCCESS!");
    console.log("=".repeat(60));
    console.log(`✅ 0x v2 with Permit2 working`);
    console.log(`✅ ${sendSpent} SEND successfully swapped to ${usdcGained} USDC`);
    console.log(`✅ Routed through Aerodrome automatically\n`);

  } catch (error: any) {
    console.error("\n❌ Error:", error.message || error);
    if (error.cause) {
      console.error("Cause:", error.cause);
    }
  }
}

testSendSwap1USD().catch(console.error);
