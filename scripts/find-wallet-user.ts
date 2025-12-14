/**
 * Find which user identifier generates a specific wallet address
 */

import { generateUserOfframpWallet, generateOfframpWallet } from "../lib/offramp-wallet";

const targetWallet = "0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2";

// Test with known user identifiers from the transaction
const testIdentifiers = [
  "6b2134d0-3b88-4318-8df1-226c0a836bd5", // user_id from transaction
  "lightblockofweb3@gmail.com", // user_email from transaction
  "guest_7034494055", // guest identifier
  "offramp_Y81PZ3oLNTjY", // transaction_id (old system)
];

console.log(`\n🔍 Finding User Identifier for Wallet`);
console.log(`=====================================\n`);
console.log(`Target Wallet: ${targetWallet}\n`);

for (const identifier of testIdentifiers) {
  try {
    const wallet = generateUserOfframpWallet(identifier);
    const match = wallet.address.toLowerCase() === targetWallet.toLowerCase();
    console.log(`${match ? "✅" : "❌"} ${identifier}`);
    console.log(`   Generated: ${wallet.address}`);
    console.log(`   Match: ${match}\n`);
    
    if (match) {
      console.log(`🎯 FOUND! User identifier: ${identifier}\n`);
      break;
    }
  } catch (error: any) {
    console.log(`❌ ${identifier} - Error: ${error.message}\n`);
  }
}

// Try old transaction-based system
try {
  const oldWallet = generateOfframpWallet("offramp_Y81PZ3oLNTjY");
  const match = oldWallet.address.toLowerCase() === targetWallet.toLowerCase();
  console.log(`${match ? "✅" : "❌"} Old System (transaction_id: offramp_Y81PZ3oLNTjY)`);
  console.log(`   Generated: ${oldWallet.address}`);
  console.log(`   Match: ${match}\n`);
} catch (error: any) {
  console.log(`❌ Old System - Error: ${error.message}\n`);
}

