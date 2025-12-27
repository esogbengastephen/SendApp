/**
 * Try all mnemonics from backup files
 */
import { ethers } from "ethers";

const MNEMONICS = [
  "plate capable vocal jacket arch limit slim ketchup travel nation mistake acid",
  "logic choose ketchup over pen forum cupboard unhappy wool punch robot crew",
  "spray poem meat special horror cousin parrot number student file target area",
];

const TEST_WALLET = "0x6905325f09Bd165C6F983519070979b9F4B232ec";
const TEST_TX_ID = "offramp_NpVxYXVB0l6s";
const TEST_USER = "guest";

console.log(`\n🔍 Testing All Mnemonics\n`);
console.log(`Target: ${TEST_WALLET}\n`);

for (let i = 0; i < MNEMONICS.length; i++) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Mnemonic ${i + 1}: ${MNEMONICS[i].substring(0, 30)}...`);
  console.log(`${"=".repeat(60)}`);
  
  // Try transaction-based
  try {
    const indexHash = ethers.keccak256(ethers.toUtf8Bytes(TEST_TX_ID));
    const indexNumber = BigInt(indexHash) % BigInt(2147483647);
    
    const mnemonic = ethers.Mnemonic.fromPhrase(MNEMONICS[i]);
    const seed = mnemonic.computeSeed();
    const rootNode = ethers.HDNodeWallet.fromSeed(seed);
    const wallet = rootNode.derivePath(`m/44'/60'/0'/0/${indexNumber}`);
    
    console.log(`TX-based: ${wallet.address}`);
    if (wallet.address.toLowerCase() === TEST_WALLET.toLowerCase()) {
      console.log(`✅✅✅ MATCH FOUND! TX-BASED`);
      console.log(`Private Key: ${wallet.privateKey}`);
      process.exit(0);
    }
  } catch (error) {}
  
  // Try user-based
  try {
    const indexHash = ethers.keccak256(ethers.toUtf8Bytes(`user_${TEST_USER.toLowerCase()}`));
    const indexNumber = BigInt(indexHash) % BigInt(2147483647);
    
    const mnemonic = ethers.Mnemonic.fromPhrase(MNEMONICS[i]);
    const seed = mnemonic.computeSeed();
    const rootNode = ethers.HDNodeWallet.fromSeed(seed);
    const wallet = rootNode.derivePath(`m/44'/60'/0'/0/${indexNumber}`);
    
    console.log(`User-based: ${wallet.address}`);
    if (wallet.address.toLowerCase() === TEST_WALLET.toLowerCase()) {
      console.log(`✅✅✅ MATCH FOUND! USER-BASED`);
      console.log(`Private Key: ${wallet.privateKey}`);
      process.exit(0);
    }
  } catch (error) {}
}

console.log(`\n❌ No match found with any mnemonic\n`);
