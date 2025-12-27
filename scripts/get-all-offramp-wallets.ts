/**
 * Get all unique offramp wallet addresses from database
 */

// Load .env.local file FIRST
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
} catch (error) {
  console.error("⚠️  Could not read .env.local file.");
}

// Now import modules
import { supabaseAdmin } from "../lib/supabase";

async function main() {
  console.log("\n🔍 Fetching all offramp wallet addresses...\n");
  
  const { data, error } = await supabaseAdmin
    .from('offramp_transactions')
    .select('unique_wallet_address, user_email, created_at, status')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log("No offramp transactions found.");
    return;
  }
  
  const uniqueWallets = [...new Set(data.map(t => t.unique_wallet_address))];
  
  console.log(`📋 Found ${uniqueWallets.length} unique wallet addresses:\n`);
  uniqueWallets.forEach((addr, i) => {
    const txs = data.filter(t => t.unique_wallet_address === addr);
    console.log(`${i + 1}. ${addr}`);
    console.log(`   Transactions: ${txs.length}`);
    console.log(`   Latest status: ${txs[0].status}`);
    console.log(`   User: ${txs[0].user_email}`);
    console.log();
  });
  
  console.log("\n📋 Array format for recovery script:\n");
  console.log("const WALLETS_TO_RECOVER = [");
  uniqueWallets.forEach(addr => {
    console.log(`  "${addr}",`);
  });
  console.log("];\n");
  
  console.log(`\n✅ Total: ${uniqueWallets.length} unique wallets to recover\n`);
}

main().catch(console.error);
