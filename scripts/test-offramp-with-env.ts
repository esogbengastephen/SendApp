/**
 * Test off-ramp system with direct .env.local loading
 */

import { readFileSync } from "fs";
import { join } from "path";

// Load .env.local manually
const envPath = join(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");

envContent.split("\n").forEach(line => {
  const match = line.match(/^([^=]+)=["']?([^"']+)["']?$/);
  if (match) {
    const [, key, value] = match;
    if (key && !key.startsWith("#")) {
      process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, "");
    }
  }
});

console.log("\n✅ Loaded environment variables from .env.local");
console.log(`Mnemonic loaded: ${process.env.OFFRAMP_MASTER_MNEMONIC?.substring(0, 30)}...`);
console.log(`Word count: ${process.env.OFFRAMP_MASTER_MNEMONIC?.split(" ").length}\n`);

// Now run the verification
import("./verify-mnemonic.js").then(() => {
  console.log("\n🚀 Starting complete off-ramp test...\n");
  return import("./test-complete-offramp.js");
}).catch(console.error);
