/**
 * Quick script to verify OFFRAMP_MASTER_MNEMONIC is loaded correctly from .env.local
 */

import { ethers } from "ethers";
import * as path from "path";
import * as fs from "fs";

// Load .env.local manually
const envPath = path.join(process.cwd(), ".env.local");

if (fs.existsSync(envPath)) {
  console.log("✅ Found .env.local file at:", envPath);
  
  // Read and parse .env.local manually
  const envContent = fs.readFileSync(envPath, "utf-8");
  const lines = envContent.split("\n");
  let mnemonic = "";
  
  for (const line of lines) {
    if (line.startsWith("OFFRAMP_MASTER_MNEMONIC=")) {
      mnemonic = line.split("=")[1].trim().replace(/^["']|["']$/g, "");
      break;
    }
  }
  
  console.log("\n🔍 Checking OFFRAMP_MASTER_MNEMONIC...\n");
  
  if (!mnemonic) {
    console.log("❌ OFFRAMP_MASTER_MNEMONIC is NOT SET");
    console.log("\n📝 Please add this to .env.local:");
    console.log('OFFRAMP_MASTER_MNEMONIC="plate capable vocal jacket arch limit slim ketchup travel nation mistake acid"');
    process.exit(1);
  }
  
  console.log("✅ OFFRAMP_MASTER_MNEMONIC is set");
  console.log(`   Length: ${mnemonic.length} characters`);
  console.log(`   Word count: ${mnemonic.split(" ").length} words`);
  console.log(`   Preview: ${mnemonic.substring(0, 20)}...`);
  
  // Try to validate it
  try {
    const mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic);
    const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonicObj);
    
    console.log("\n✅ Mnemonic is VALID!");
    console.log(`   Master Address: ${wallet.address}`);
    console.log("\n🎉 Your off-ramp button should work now!");
    
  } catch (error: any) {
    console.log("\n❌ Mnemonic is INVALID!");
    console.log(`   Error: ${error.message}`);
    console.log("\n📝 Replace your mnemonic with:");
    console.log('OFFRAMP_MASTER_MNEMONIC="plate capable vocal jacket arch limit slim ketchup travel nation mistake acid"');
    process.exit(1);
  }
  
} else {
  console.log("❌ .env.local file NOT FOUND at:", envPath);
  console.log("\n📝 Create .env.local and add:");
  console.log('OFFRAMP_MASTER_MNEMONIC="plate capable vocal jacket arch limit slim ketchup travel nation mistake acid"');
  process.exit(1);
}
