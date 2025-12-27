/**
 * Test the wallet scanner directly
 */

import { scanWalletForAllTokens } from "../lib/wallet-scanner";

const OFFRAMP_WALLET = "0x6905325f09Bd165C6F983519070979b9F4B232ec";

async function testScanner() {
  console.log("🔍 Testing Wallet Scanner");
  console.log("Wallet:", OFFRAMP_WALLET);
  console.log("RPC:", process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org");
  console.log("");

  try {
    const tokens = await scanWalletForAllTokens(OFFRAMP_WALLET);
    
    console.log(`Found ${tokens.length} token(s):`);
    if (tokens.length > 0) {
      tokens.forEach((token) => {
        console.log(`  ${token.symbol}: ${token.amount} (${token.address})`);
      });
    } else {
      console.log("❌ NO TOKENS FOUND");
      console.log("\nThis might be due to:");
      console.log("  1. RPC cache issue");
      console.log("  2. Token not in KNOWN_BASE_TOKENS list");
      console.log("  3. Scanner logic issue");
    }
  } catch (error) {
    console.error("❌ Scanner error:", error);
  }
}

testScanner();
