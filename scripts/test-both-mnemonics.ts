/**
 * Test both mnemonics to see which generates the correct address
 */

import { ethers } from "ethers";

const OLD_MNEMONIC = "spray poem meat special horror cousin parrot number student file target area";
const NEW_MNEMONIC = "plate capable vocal jacket arch limit slim ketchup travel nation mistake acid";
const USER_IDENTIFIER = "lightblockofweb3@gmail.com";
const EXPECTED_ADDRESS = "0x6459AE03e607E9F1A62De6bC17b6977a9F922679";

function generateWallet(mnemonic: string, userIdentifier: string) {
  try {
    const mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic);
    const seed = mnemonicObj.computeSeed();
    const rootNode = ethers.HDNodeWallet.fromSeed(seed);
    
    // Use the same derivation logic as in offramp-wallet.ts
    const hash = userIdentifier
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const derivationIndex = Math.abs(hash) % 2147483647;
    const derivationPath = `m/44'/60'/0'/0/${derivationIndex}`;
    
    const wallet = rootNode.derivePath(derivationPath);
    
    return {
      address: wallet.address,
      derivationPath,
      derivationIndex,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

console.log("🔍 Testing Both Mnemonics\n");
console.log(`User Identifier: ${USER_IDENTIFIER}`);
console.log(`Expected Address: ${EXPECTED_ADDRESS}\n`);

console.log("=" .repeat(60));
console.log("TEST 1: OLD Mnemonic");
console.log("=" .repeat(60));
console.log(`Mnemonic: ${OLD_MNEMONIC}\n`);

const oldResult = generateWallet(OLD_MNEMONIC, USER_IDENTIFIER);
if ("error" in oldResult) {
  console.log("❌ Error:", oldResult.error);
} else {
  console.log(`Derivation Path: ${oldResult.derivationPath}`);
  console.log(`Derivation Index: ${oldResult.derivationIndex}`);
  console.log(`Generated Address: ${oldResult.address}`);
  
  if (oldResult.address.toLowerCase() === EXPECTED_ADDRESS.toLowerCase()) {
    console.log("✅ ✅ ✅ MATCH! This is the CORRECT mnemonic! ✅ ✅ ✅\n");
  } else {
    console.log("❌ No match\n");
  }
}

console.log("\n" + "=".repeat(60));
console.log("TEST 2: NEW Mnemonic");
console.log("=".repeat(60));
console.log(`Mnemonic: ${NEW_MNEMONIC}\n`);

const newResult = generateWallet(NEW_MNEMONIC, USER_IDENTIFIER);
if ("error" in newResult) {
  console.log("❌ Error:", newResult.error);
} else {
  console.log(`Derivation Path: ${newResult.derivationPath}`);
  console.log(`Derivation Index: ${newResult.derivationIndex}`);
  console.log(`Generated Address: ${newResult.address}`);
  
  if (newResult.address.toLowerCase() === EXPECTED_ADDRESS.toLowerCase()) {
    console.log("✅ ✅ ✅ MATCH! This is the CORRECT mnemonic! ✅ ✅ ✅\n");
  } else {
    console.log("❌ No match\n");
  }
}

