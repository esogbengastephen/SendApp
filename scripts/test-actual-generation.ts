/**
 * Test if the ACTUAL lib/offramp-wallet.ts can generate the correct addresses
 * This will use whatever mnemonic is currently loaded
 */

// Load env first
import { readFileSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  const lines = envContent.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
        process.env[key.trim()] = value;
      }
    }
  }
  console.log("✅ Loaded .env.local\n");
} catch (error) {
  console.error("⚠️  Could not read .env.local");
}

// Now import the actual wallet library
import { generateUserOfframpWallet, generateOfframpWallet } from "../lib/offramp-wallet";

const TEST_CASES = [
  {
    wallet: "0x6905325f09Bd165C6F983519070979b9F4B232ec",
    txId: "offramp_NpVxYXVB0l6s",
    userIdentifier: "guest",
  },
  {
    wallet: "0x20717a8732d3341201fa33a06bbe5ed91dbfdeb2",
    txId: "offramp_test_ZBAzkllx",
    userIdentifier: "test@example.com",
  },
  {
    wallet: "0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2",
    txId: "offramp_Y81PZ3oLNTjY",
    userIdentifier: "6b2134d0-3b88-4318-8df1-226c0a836bd5",
  },
];

console.log("🧪 Testing Actual Wallet Generation\n");

for (const test of TEST_CASES) {
  console.log(`${"=".repeat(60)}`);
  console.log(`Target: ${test.wallet}`);
  console.log(`TX ID: ${test.txId}`);
  console.log(`User ID: ${test.userIdentifier}\n`);
  
  // Try transaction-based
  try {
    const wallet = generateOfframpWallet(test.txId);
    console.log(`TX-based: ${wallet.address}`);
    if (wallet.address.toLowerCase() === test.wallet.toLowerCase()) {
      console.log(`✅✅✅ MATCH! Private key: ${wallet.privateKey}`);
      continue;
    }
  } catch (error: any) {
    console.log(`TX-based: ❌ ${error.message}`);
  }
  
  // Try user-based
  try {
    const wallet = generateUserOfframpWallet(test.userIdentifier);
    console.log(`User-based: ${wallet.address}`);
    if (wallet.address.toLowerCase() === test.wallet.toLowerCase()) {
      console.log(`✅✅✅ MATCH! Private key: ${wallet.privateKey}`);
      continue;
    }
  } catch (error: any) {
    console.log(`User-based: ❌ ${error.message}`);
  }
  
  console.log(`❌ No match\n`);
}
