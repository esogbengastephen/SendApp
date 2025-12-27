import { readFileSync } from "fs";
import { join } from "path";

// Load env
const envPath = join(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
envContent.split("\n").forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const [key, ...parts] = trimmed.split("=");
    if (key && parts.length) {
      process.env[key.trim()] = parts.join("=").replace(/^["']|["']$/g, "");
    }
  }
});

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('offramp_transactions')
    .select('unique_wallet_address, status, token_symbol, token_amount, created_at')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  const uniqueWallets = [...new Set(data?.map(t => t.unique_wallet_address) || [])];
  
  console.log('\n📋 All Offramp Wallets:\n');
  console.log('const ALL_WALLETS = [');
  uniqueWallets.forEach(w => console.log(`  "${w}",`));
  console.log('];\n');
  
  console.log(`Total: ${uniqueWallets.length} wallets\n`);
  
  // Show status of each
  console.log('Wallet Details:\n');
  uniqueWallets.forEach(wallet => {
    const txs = data?.filter(t => t.unique_wallet_address === wallet) || [];
    console.log(`${wallet}:`);
    txs.forEach(tx => {
      console.log(`  - Status: ${tx.status}, Token: ${tx.token_symbol || 'N/A'}, Amount: ${tx.token_amount || 'N/A'}`);
    });
    console.log();
  });
}

main().catch(console.error);
