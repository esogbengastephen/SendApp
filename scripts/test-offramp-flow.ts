/**
 * Test Complete Offramp Flow
 * Generates a test wallet and walks through the entire offramp process
 */

import { readFileSync } from "fs";
import { join } from "path";
import { ethers } from "ethers";

// Load environment variables from .env.local
const envPath = join(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");

let MASTER_MNEMONIC = "";
envContent.split("\n").forEach((line) => {
  if (line.startsWith("OFFRAMP_MASTER_MNEMONIC=")) {
    MASTER_MNEMONIC = line.split("=")[1].replace(/"/g, "").trim();
  }
});

if (!MASTER_MNEMONIC) {
  console.error("❌ OFFRAMP_MASTER_MNEMONIC not found!");
  process.exit(1);
}

console.log("🧪 OFFRAMP TEST WALLET GENERATOR\n");
console.log("=".repeat(60));

// Generate test wallet using same logic as the system
const testUserId = `test_${Date.now()}`; // Unique test user ID
const userIdentifier = testUserId;

// Hash user identifier to get derivation index
const indexHash = ethers.keccak256(ethers.toUtf8Bytes(`user_${userIdentifier.toLowerCase()}`));
const indexNumber = BigInt(indexHash) % BigInt(2147483647);
const derivationPath = `m/44'/60'/0'/0/${indexNumber}`;

// Derive wallet
const mnemonic = ethers.Mnemonic.fromPhrase(MASTER_MNEMONIC);
const seed = mnemonic.computeSeed();
const rootNode = ethers.HDNodeWallet.fromSeed(seed);
const wallet = rootNode.derivePath(derivationPath);

console.log("\n📋 TEST USER DETAILS:");
console.log(`   User ID: ${testUserId}`);
console.log(`   Derivation Path: ${derivationPath}`);
console.log(`   Derivation Index: ${indexNumber.toString()}`);

console.log("\n🔑 TEST WALLET:");
console.log(`   Address: ${wallet.address}`);
console.log(`   Private Key: ${wallet.privateKey}`);

console.log("\n📝 TESTING INSTRUCTIONS:");
console.log("=".repeat(60));
console.log("\n1️⃣  GENERATE ADDRESS (via API):");
console.log(`   POST /api/offramp/generate-address`);
console.log(`   Body: {`);
console.log(`     "accountNumber": "1234567890",`);
console.log(`     "accountName": "Test User",`);
console.log(`     "bankCode": "058",`);
console.log(`     "userEmail": "${testUserId}@test.com"`);
console.log(`   }`);
console.log(`   Expected wallet address: ${wallet.address}`);

console.log("\n2️⃣  FUND THIS WALLET:");
console.log(`   Send test tokens to: ${wallet.address}`);
console.log(`   Recommended: 1 USDC or 0.001 ETH or small amount of SEND`);
console.log(`   Network: Base (Chain ID: 8453)`);

console.log("\n3️⃣  CHECK FOR TOKENS:");
console.log(`   POST /api/offramp/check-token`);
console.log(`   Body: { "transactionId": "<transaction_id_from_step_1>" }`);
console.log(`   This will auto-trigger the swap!`);

console.log("\n4️⃣  VERIFY SWAP:");
console.log(`   Check transaction status in database`);
console.log(`   Or check BaseScan: https://basescan.org/address/${wallet.address}`);

console.log("\n5️⃣  TRIGGER PAYMENT:");
console.log(`   POST /api/offramp/process-payment`);
console.log(`   Body: { "transactionId": "<transaction_id_from_step_1>" }`);

console.log("\n" + "=".repeat(60));
console.log("✅ Test wallet ready! Fund it and let's begin testing.\n");

// Save test user info for easy reference
console.log("💾 SAVE THIS INFO:");
console.log(`   Test User Email: ${testUserId}@test.com`);
console.log(`   Test Wallet: ${wallet.address}`);
console.log(`   Test Account: 1234567890 (Guaranty Trust Bank - 058)`);
