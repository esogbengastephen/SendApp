/**
 * Check when wallets were created vs when mnemonic might have changed
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ksdzzqdafodlstfkqzuv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzZHp6cWRhZm9kbHN0ZmtxenV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzY3NjYxNSwiZXhwIjoyMDc5MjUyNjE1fQ.bYpA34vIz5hjzHDNTBEZd4EpRpOk2wOcb228EkaljWc";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data: transactions } = await supabase
    .from('offramp_transactions')
    .select('transaction_id, unique_wallet_address, created_at')
    .order('created_at', { ascending: true });
  
  if (!transactions) {
    console.log("No transactions found");
    return;
  }
  
  console.log('\n📅 Wallet Creation Timeline:\n');
  
  const uniqueWallets = [...new Set(transactions.map(t => t.unique_wallet_address))];
  
  for (const wallet of uniqueWallets) {
    const tx = transactions.find(t => t.unique_wallet_address === wallet);
    console.log(`${wallet}:`);
    console.log(`  Created: ${tx?.created_at}`);
    console.log(`  TX ID: ${tx?.transaction_id}\n`);
  }
  
  console.log('\n💡 Suggestion: These wallets might have been created with a');
  console.log('   different mnemonic or using a manual wallet creation method.');
  console.log('\n   Check your .env.local file history or deployment logs for');
  console.log('   when OFFRAMP_MASTER_MNEMONIC was set/changed.\n');
}

main().catch(console.error);
