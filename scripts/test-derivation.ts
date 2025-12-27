/**
 * Test if we can derive the correct wallet address
 */
import { ethers } from "ethers";

const MASTER_MNEMONIC = "plate capable vocal jacket arch limit slim ketchup travel nation mistake acid";

// Test case: First wallet
const TEST_WALLET = "0x6905325f09Bd165C6F983519070979b9F4B232ec";
const TEST_TX_ID = "offramp_NpVxYXVB0l6s";
const TEST_USER = "guest";

console.log(`\n🧪 Testing Derivation\n`);
console.log(`Target Wallet: ${TEST_WALLET}`);
console.log(`Transaction ID: ${TEST_TX_ID}`);
console.log(`User: ${TEST_USER}\n`);

// Try transaction-based derivation
console.log("1️⃣ Transaction-based derivation:");
try {
  const indexHash = ethers.keccak256(ethers.toUtf8Bytes(TEST_TX_ID));
  const indexNumber = BigInt(indexHash) % BigInt(2147483647);
  console.log(`   Index: ${indexNumber}`);
  
  const derivationPath = `m/44'/60'/0'/0/${indexNumber}`;
  console.log(`   Path: ${derivationPath}`);
  
  const mnemonic = ethers.Mnemonic.fromPhrase(MASTER_MNEMONIC);
  const seed = mnemonic.computeSeed();
  const rootNode = ethers.HDNodeWallet.fromSeed(seed);
  const wallet = rootNode.derivePath(derivationPath);
  
  console.log(`   Derived: ${wallet.address}`);
  console.log(`   Match: ${wallet.address.toLowerCase() === TEST_WALLET.toLowerCase() ? '✅' : '❌'}`);
  
  if (wallet.address.toLowerCase() === TEST_WALLET.toLowerCase()) {
    console.log(`   ✅ SUCCESS! Private key: ${wallet.privateKey}`);
  }
} catch (error: any) {
  console.log(`   ❌ Error: ${error.message}`);
}

// Try user-based derivation
console.log("\n2️⃣ User-based derivation:");
try {
  const indexHash = ethers.keccak256(ethers.toUtf8Bytes(`user_${TEST_USER.toLowerCase()}`));
  const indexNumber = BigInt(indexHash) % BigInt(2147483647);
  console.log(`   Index: ${indexNumber}`);
  
  const derivationPath = `m/44'/60'/0'/0/${indexNumber}`;
  console.log(`   Path: ${derivationPath}`);
  
  const mnemonic = ethers.Mnemonic.fromPhrase(MASTER_MNEMONIC);
  const seed = mnemonic.computeSeed();
  const rootNode = ethers.HDNodeWallet.fromSeed(seed);
  const wallet = rootNode.derivePath(derivationPath);
  
  console.log(`   Derived: ${wallet.address}`);
  console.log(`   Match: ${wallet.address.toLowerCase() === TEST_WALLET.toLowerCase() ? '✅' : '❌'}`);
  
  if (wallet.address.toLowerCase() === TEST_WALLET.toLowerCase()) {
    console.log(`   ✅ SUCCESS! Private key: ${wallet.privateKey}`);
  }
} catch (error: any) {
  console.log(`   ❌ Error: ${error.message}`);
}

console.log();
