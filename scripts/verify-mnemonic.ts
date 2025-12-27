/**
 * Verify the mnemonic phrase is valid
 */

import { ethers } from "ethers";

const mnemonic = process.env.OFFRAMP_MASTER_MNEMONIC;

console.log("\n🔍 Verifying Mnemonic\n");
console.log("=".repeat(60));

if (!mnemonic) {
  console.error("❌ OFFRAMP_MASTER_MNEMONIC not found in environment");
  process.exit(1);
}

console.log(`Mnemonic value: "${mnemonic}"`);
console.log(`Length: ${mnemonic.length} characters`);
console.log(`Word count: ${mnemonic.trim().split(/\s+/).length} words`);

try {
  // Try to create a mnemonic from the phrase
  const mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic.trim());
  console.log("\n✅ Mnemonic is VALID!");
  
  // Derive the first wallet
  const seed = mnemonicObj.computeSeed();
  const rootNode = ethers.HDNodeWallet.fromSeed(seed);
  const wallet = rootNode.derivePath("m/44'/60'/0'/0/0");
  
  console.log(`\n🔑 Master Wallet (m/44'/60'/0'/0/0):`);
  console.log(`   Address: ${wallet.address}`);
  console.log(`   Private Key: ${wallet.privateKey.substring(0, 10)}...`);
  
  console.log("\n✅ Mnemonic verification successful!\n");
} catch (error: any) {
  console.error("\n❌ Invalid mnemonic:", error.message);
  console.error("\nPlease check:");
  console.error("1. Mnemonic has 12 or 24 words");
  console.error("2. No extra quotes or special characters");
  console.error("3. Words are separated by single spaces\n");
  process.exit(1);
}
