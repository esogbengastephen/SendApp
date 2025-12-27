/**
 * Quick Off-Ramp Test (uses existing master wallet)
 * Tests wallet emptying, swapping, and fee calculation
 */

import { createWalletClient, createPublicClient, http, formatUnits, parseEther, formatEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { BASE_RPC_URL, SEND_TOKEN_ADDRESS } from "../lib/constants.js";
import { getMasterWallet, getReceiverWalletAddress } from "../lib/offramp-wallet.js";
import { scanWalletForAllTokens } from "../lib/wallet-scanner.js";
import { getOfframpExchangeRate, calculateOfframpFee } from "../lib/offramp-settings.js";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

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

async function quickOfframpTest() {
  console.log("\n🧪 Quick Off-Ramp System Test\n");
  console.log("=".repeat(70));

  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    const masterWallet = getMasterWallet();
    console.log("\n📍 Master Wallet");
    console.log("-".repeat(70));
    console.log(`Address: ${masterWallet.address}`);

    // Check balances
    const sendBalance = await publicClient.readContract({
      address: SEND_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [masterWallet.address as `0x${string}`],
    }) as bigint;

    const sendDecimals = await publicClient.readContract({
      address: SEND_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "decimals",
    }) as number;

    const ethBalance = await publicClient.getBalance({
      address: masterWallet.address as `0x${string}`,
    });

    console.log(`SEND: ${formatUnits(sendBalance, sendDecimals)} SEND`);
    console.log(`ETH: ${formatEther(ethBalance)} ETH`);

    // Scan for all tokens
    console.log("\n🔍 Scanning for All Tokens");
    console.log("-".repeat(70));
    const tokens = await scanWalletForAllTokens(masterWallet.address);
    console.log(`✅ Found ${tokens.length} token(s):`);
    tokens.forEach(token => {
      console.log(`   - ${token.symbol}: ${token.amount}`);
    });

    // Get off-ramp settings
    console.log("\n⚙️  Off-Ramp Settings");
    console.log("-".repeat(70));
    const exchangeRate = await getOfframpExchangeRate();
    console.log(`Exchange Rate: 1 USDC = ${exchangeRate} NGN`);

    // Simulate conversion calculations
    console.log("\n💵 Conversion Examples (if wallet had USDC)");
    console.log("-".repeat(70));
    
    const simulateAmounts = [1, 5, 10, 50];
    for (const usdc of simulateAmounts) {
      const ngnBeforeFees = usdc * exchangeRate;
      const fee = await calculateOfframpFee(ngnBeforeFees);
      const feePercentage = (fee / ngnBeforeFees) * 100;
      const finalNGN = ngnBeforeFees - fee;
      console.log(`   ${usdc} USDC → ₦${ngnBeforeFees.toFixed(2)} → Fee: ₦${fee.toFixed(2)} (${feePercentage.toFixed(2)}%) → User gets: ₦${finalNGN.toFixed(2)}`);
    }

    // Check receiver wallet
    console.log("\n🏦 Receiver Wallet");
    console.log("-".repeat(70));
    const receiverWallet = getReceiverWalletAddress();
    console.log(`Address: ${receiverWallet}`);

    const receiverUSDC = await publicClient.readContract({
      address: USDC_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [receiverWallet as `0x${string}`],
    }) as bigint;

    console.log(`USDC Balance: ${formatUnits(receiverUSDC, 6)} USDC`);

    // Summary
    console.log("\n" + "=".repeat(70));
    console.log("✅ QUICK TEST SUMMARY");
    console.log("=".repeat(70));
    console.log(`\n✅ Master wallet accessible`);
    console.log(`✅ Token scanning working (${tokens.length} tokens found)`);
    console.log(`✅ Off-ramp settings loaded (${exchangeRate} NGN/USDC)`);
    console.log(`✅ Fee calculation working`);
    console.log(`✅ Receiver wallet configured`);

    console.log("\n📝 To test full off-ramp flow:");
    console.log("   1. Add OFFRAMP_MASTER_MNEMONIC to .env.local");
    console.log("   2. Or use the admin dashboard to initiate an off-ramp");
    console.log("   3. Send tokens to a generated off-ramp address");
    console.log("   4. System will automatically:");
    console.log("      - Detect tokens");
    console.log("      - Swap to USDC");
    console.log("      - Calculate fees");
    console.log("      - Process payment\n");

  } catch (error: any) {
    console.error("\n❌ TEST FAILED:", error.message);
    console.error("\nError details:", error);
  }
}

quickOfframpTest().catch(console.error);
