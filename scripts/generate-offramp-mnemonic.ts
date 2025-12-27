/**
 * Generate a valid BIP39 mnemonic for off-ramp wallet system
 */

import { ethers } from "ethers";

console.log("\n🔐 Generating Off-Ramp Master Mnemonic\n");
console.log("=".repeat(60));

// Generate a new random wallet
const wallet = ethers.Wallet.createRandom();

console.log("\n✅ Generated new BIP39 mnemonic phrase:\n");
console.log(`   ${wallet.mnemonic?.phrase}\n`);
console.log("=".repeat(60));

console.log("\n📝 Add this to your .env.local file:\n");
console.log(`OFFRAMP_MASTER_MNEMONIC="${wallet.mnemonic?.phrase}"`);

console.log("\n🔑 Derived wallet info:");
console.log(`   Address: ${wallet.address}`);
console.log(`   Private Key: ${wallet.privateKey}`);

console.log("\n⚠️  IMPORTANT:");
console.log("   1. Save the mnemonic securely (back it up!)");
console.log("   2. Add it to .env.local as OFFRAMP_MASTER_MNEMONIC");
console.log("   3. Fund the master address with ETH for gas fees");
console.log("   4. Keep the mnemonic SECRET - never commit to git\n");
