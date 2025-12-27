/**
 * Test script to check if the wallet scanner can detect SEND tokens
 */

import { scanWalletForAllTokens } from "../lib/wallet-scanner";

const WALLET_ADDRESS = "0x6459AE03e607E9F1A62De6bC17b6977a9F922679";

async function testTokenDetection() {
  console.log("🔍 Testing Token Detection\n");
  console.log(`Wallet: ${WALLET_ADDRESS}`);
  console.log(`RPC: ${process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://base.llamarpc.com"}\n`);
  
  try {
    console.log("Scanning wallet for tokens...\n");
    const tokens = await scanWalletForAllTokens(WALLET_ADDRESS);
    
    if (tokens.length === 0) {
      console.log("❌ NO TOKENS FOUND");
      console.log("\nThis might be because:");
      console.log("1. RPC endpoint has stale cache");
      console.log("2. Token not in KNOWN_BASE_TOKENS list");
      console.log("3. Network connectivity issue\n");
    } else {
      console.log(`✅ Found ${tokens.length} token(s):\n`);
      tokens.forEach((token) => {
        console.log(`  ${token.symbol}: ${token.amount}`);
        console.log(`    Address: ${token.address || "Native ETH"}`);
        console.log(`    Raw Amount: ${token.amountRaw}`);
        console.log(`    Decimals: ${token.decimals}\n`);
      });
    }
  } catch (error) {
    console.error("❌ Error scanning wallet:", error);
  }
}

testTokenDetection();
