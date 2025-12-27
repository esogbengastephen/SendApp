/**
 * Verify that the OLD mnemonic generates the correct wallet address
 */

import { ethers } from "ethers";

const OLD_MNEMONIC = "spray poem meat special horror cousin parrot number student file target area";
const EXPECTED_ADDRESS = "0x6459AE03e607E9F1A62De6bC17b6977a9F922679";

console.log("🔍 Verifying OLD mnemonic...\n");
console.log(`Mnemonic: ${OLD_MNEMONIC}`);
console.log(`Expected address: ${EXPECTED_ADDRESS}\n`);

try {
  // Validate mnemonic
  const mnemonic = ethers.Mnemonic.fromPhrase(OLD_MNEMONIC);
  console.log("✅ Mnemonic is valid (12 words)\n");
  
  // Generate wallet using the same derivation path
  const seed = mnemonic.computeSeed();
  const rootNode = ethers.HDNodeWallet.fromSeed(seed);
  
  // Test different derivation paths
  const paths = [
    "m/44'/60'/0'/0/0",
    "m/44'/60'/0'/0/1",
  ];
  
  for (const path of paths) {
    const wallet = rootNode.derivePath(path);
    console.log(`Path: ${path}`);
    console.log(`Address: ${wallet.address}`);
    
    if (wallet.address.toLowerCase() === EXPECTED_ADDRESS.toLowerCase()) {
      console.log("✅ MATCH FOUND! This is the correct mnemonic!\n");
      break;
    } else {
      console.log("❌ No match\n");
    }
  }
  
  // Also test with a specific user identifier
  const userIdentifier = "test@example.com";
  const userPath = `m/44'/60'/0'/0/${Math.abs(
    userIdentifier.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  ) % 2147483647}`;
  
  const userWallet = rootNode.derivePath(userPath);
  console.log(`\nUser Path for "${userIdentifier}": ${userPath}`);
  console.log(`Address: ${userWallet.address}`);
  
  if (userWallet.address.toLowerCase() === EXPECTED_ADDRESS.toLowerCase()) {
    console.log("✅ MATCH FOUND! This is the correct mnemonic!\n");
  }
  
} catch (error) {
  console.error("❌ Error:", error);
  process.exit(1);
}

