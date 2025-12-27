/**
 * Check master wallet balance and gas capacity
 */

import { createPublicClient, http, formatEther } from "viem";
import { base } from "viem/chains";
import { ethers } from "ethers";

const MASTER_PRIVATE_KEY = process.env.OFFRAMP_MASTER_WALLET_PRIVATE_KEY;

async function checkMasterWallet() {
  const masterWallet = new ethers.Wallet(MASTER_PRIVATE_KEY!);

  console.log("🔐 Master Wallet (Gas Source):");
  console.log("Address:", masterWallet.address);
  console.log("");

  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
  });

  const balance = await publicClient.getBalance({
    address: masterWallet.address as `0x${string}`,
  });

  console.log("💰 Current Balance:");
  console.log("ETH:", formatEther(balance));
  console.log("");

  const estimatedGasForSwap = 0.0005; // ~500k gas at 1 gwei
  const estimatedGasForRecovery = 0.00003; // ~21k gas

  console.log("⛽ Gas Flow per Off-Ramp Transaction:");
  console.log("  1️⃣  Forward to user wallet: ~0.0005 ETH (for swap)");
  console.log("  2️⃣  Swap executes: user wallet pays gas");
  console.log("  3️⃣  Recover leftover ETH back to master");
  console.log("  4️⃣  Net cost: ~0.00053 ETH (gas consumed)");
  console.log("");

  const availableTransactions = Math.floor(
    Number(formatEther(balance)) / estimatedGasForSwap
  );
  
  if (availableTransactions > 0) {
    console.log(`✅ Can process approximately ${availableTransactions} off-ramp transactions`);
  } else {
    console.log("❌ Insufficient ETH balance for gas!");
    console.log("   Please fund master wallet with ETH for gas fees");
  }
}

checkMasterWallet();

