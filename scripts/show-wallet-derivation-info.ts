/**
 * Show what info is stored in DB for each wallet to help with key derivation
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ksdzzqdafodlstfkqzuv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzZHp6cWRhZm9kbHN0ZmtxenV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzY3NjYxNSwiZXhwIjoyMDc5MjUyNjE1fQ.bYpA34vIz5hjzHDNTBEZd4EpRpOk2wOcb228EkaljWc";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data: transactions } = await supabase
    .from('offramp_transactions')
    .select('transaction_id, unique_wallet_address, user_id, user_email, user_account_number')
    .order('created_at', { ascending: false });
  
  if (!transactions) {
    console.log("No transactions found");
    return;
  }
  
  const uniqueWallets = [...new Set(transactions.map(t => t.unique_wallet_address))];
  
  console.log('\n📋 Wallet Derivation Info:\n');
  
  for (const wallet of uniqueWallets) {
    const txs = transactions.filter(t => t.unique_wallet_address === wallet);
    console.log(`${wallet}:`);
    
    txs.forEach(tx => {
      console.log(`  Transaction ID: ${tx.transaction_id}`);
      console.log(`  User ID: ${tx.user_id || 'null'}`);
      console.log(`  User Email: ${tx.user_email || 'null'}`);
      console.log(`  User Account: ${tx.user_account_number || 'null'}`);
      
      // Show what will be used for derivation
      const userIdentifier = tx.user_id || tx.user_email || `guest_${tx.user_account_number}`;
      console.log(`  → Will try tx-based: "${tx.transaction_id}"`);
      console.log(`  → Will try user-based: "${userIdentifier}"`);
      console.log();
    });
  }
}

main().catch(console.error);
