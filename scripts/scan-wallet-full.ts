/**
 * Full wallet scan - check all tokens
 * Usage: npx tsx scripts/scan-wallet-full.ts <walletAddress>
 */

import { scanWalletForAllTokens } from "../lib/wallet-scanner";

const walletAddress = process.argv[2];

if (!walletAddress) {
  console.error("Usage: npx tsx scripts/scan-wallet-full.ts <walletAddress>");
  process.exit(1);
}

async function scanWallet() {
  console.log(`\n🔍 Scanning wallet: ${walletAddress}\n`);

  try {
    const tokens = await scanWalletForAllTokens(walletAddress);

    if (tokens.length === 0) {
      console.log("❌ No tokens found in this wallet\n");
      return;
    }

    console.log(`✅ Found ${tokens.length} token(s):\n`);
    tokens.forEach((token, i) => {
      console.log(`${i + 1}. ${token.symbol}: ${token.amount}`);
      console.log(`   Address: ${token.address || "Native ETH"}`);
      console.log(`   Raw Amount: ${token.amountRaw}`);
      console.log("");
    });
  } catch (error: any) {
    console.error("❌ Error scanning wallet:", error.message);
    process.exit(1);
  }
}

scanWallet();

