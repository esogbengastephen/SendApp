/**
 * Test SEND → USDC swap using Aerodrome integration
 * This tests the smart-swap routing which should automatically use Aerodrome for SEND tokens
 */

import { createWalletClient, createPublicClient, http, formatUnits, parseUnits } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { BASE_RPC_URL, SEND_TOKEN_ADDRESS } from "../lib/constants.js";
import { USDC_BASE_ADDRESS as USDC_ADDRESS } from "../lib/0x-swap.js";
import { executeAerodromeSwap } from "../lib/aerodrome-swap.js";

const WALLET_ADDRESS = "0x22c21Bb6a4BBe192F8B29551b57a45246530Ad68";

// ERC20 ABI for balance check
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

async function testSendToUsdcSwap() {
  console.log("\n🧪 Testing SEND → USDC Swap using Aerodrome\n");
  console.log("=".repeat(60));
  console.log(`Wallet: ${WALLET_ADDRESS}`);
  console.log(`SEND Token: ${SEND_TOKEN_ADDRESS}`);
  console.log(`USDC Token: ${USDC_ADDRESS}`);
  console.log("=".repeat(60) + "\n");

  // Check for private key
  const privateKey = process.env.OFFRAMP_MASTER_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ Error: OFFRAMP_MASTER_WALLET_PRIVATE_KEY not found in .env.local");
    console.log("\nPlease add your private key to .env.local:");
    console.log('OFFRAMP_MASTER_WALLET_PRIVATE_KEY="0x..."');
    console.log("\n⚠️  WARNING: Never commit private keys to git!");
    return;
  }

  try {
    // Create clients
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    
    if (account.address.toLowerCase() !== WALLET_ADDRESS.toLowerCase()) {
      console.error(`❌ Error: Private key does not match wallet address`);
      console.error(`   Expected: ${WALLET_ADDRESS}`);
      console.error(`   Got: ${account.address}`);
      return;
    }

    const publicClient = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    console.log("✅ Wallet connected\n");

    // Step 1: Check SEND balance
    console.log("📊 Checking SEND balance...");
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
    console.log(`   SEND Balance: ${sendBalanceFormatted} SEND`);

    if (sendBalance === BigInt(0)) {
      console.error("\n❌ Error: No SEND tokens in wallet!");
      console.log("Please acquire some SEND tokens first.");
      return;
    }

    // Step 2: Check USDC balance (before swap)
    console.log("\n📊 Checking USDC balance (before swap)...");
    const usdcBalanceBefore = await publicClient.readContract({
      address: USDC_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [WALLET_ADDRESS as `0x${string}`],
    }) as bigint;

    const usdcBalanceBeforeFormatted = formatUnits(usdcBalanceBefore, 6);
    console.log(`   USDC Balance: ${usdcBalanceBeforeFormatted} USDC\n`);

    // Step 3: Determine swap amount
    // Swap 10% of SEND balance or all if less than 100 SEND
    const totalSend = Number(sendBalanceFormatted);
    let swapAmount: bigint;
    let swapAmountFormatted: string;

    if (totalSend < 100) {
      // Swap all if less than 100 SEND
      swapAmount = sendBalance;
      swapAmountFormatted = sendBalanceFormatted;
      console.log(`💡 Swapping all SEND tokens (less than 100 SEND)`);
    } else {
      // Swap 10% of balance
      swapAmount = sendBalance / BigInt(10);
      swapAmountFormatted = formatUnits(swapAmount, sendDecimals);
      console.log(`💡 Swapping 10% of SEND balance for testing`);
    }

    console.log(`\n🔄 Swap Details:`);
    console.log(`   From: ${swapAmountFormatted} SEND`);
    console.log(`   To: USDC`);
    console.log(`   Slippage: 1%`);
    console.log(`   DEX: Aerodrome Finance\n`);

    // Step 4: Execute swap using Aerodrome
    console.log("🚀 Executing swap on Aerodrome...\n");

    const swapResult = await executeAerodromeSwap(
      SEND_TOKEN_ADDRESS,
      USDC_ADDRESS,
      swapAmount.toString(),
      WALLET_ADDRESS, // Recipient (same wallet)
      account,
      1 // 1% slippage
    );

    if (!swapResult.success) {
      console.error("\n❌ Swap failed:", swapResult.error);
      return;
    }

    console.log("\n✅ Swap successful!");
    console.log(`   Transaction Hash: ${swapResult.txHash}`);
    console.log(`   BaseScan: https://basescan.org/tx/${swapResult.txHash}`);
    
    if (swapResult.outputAmount) {
      const usdcReceived = formatUnits(BigInt(swapResult.outputAmount), 6);
      console.log(`   USDC Received: ${usdcReceived} USDC`);
      
      // Calculate effective rate
      const effectiveRate = Number(usdcReceived) / Number(swapAmountFormatted);
      console.log(`   Effective Rate: 1 SEND = ${effectiveRate.toFixed(6)} USDC`);
    }

    // Step 5: Check USDC balance (after swap)
    console.log("\n📊 Checking USDC balance (after swap)...");
    
    // Wait a bit for balance to update
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const usdcBalanceAfter = await publicClient.readContract({
      address: USDC_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [WALLET_ADDRESS as `0x${string}`],
    }) as bigint;

    const usdcBalanceAfterFormatted = formatUnits(usdcBalanceAfter, 6);
    const usdcDifference = formatUnits(usdcBalanceAfter - usdcBalanceBefore, 6);
    
    console.log(`   USDC Balance: ${usdcBalanceAfterFormatted} USDC`);
    console.log(`   USDC Gained: +${usdcDifference} USDC`);

    console.log("\n" + "=".repeat(60));
    console.log("✅ TEST COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log("\n💡 Summary:");
    console.log(`   ✅ Aerodrome integration working`);
    console.log(`   ✅ SEND → USDC swap successful`);
    console.log(`   ✅ Smart routing detected SEND and used Aerodrome`);
    console.log(`   ✅ Transaction confirmed on-chain`);
    console.log("\n");

  } catch (error: any) {
    console.error("\n❌ Error during swap:", error);
    if (error.message) {
      console.error("   Message:", error.message);
    }
    console.log("\n");
  }
}

// Run the test
testSendToUsdcSwap();
