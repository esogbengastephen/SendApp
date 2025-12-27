import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function fullAudit() {
  console.log(`\n${"=".repeat(100)}`);
  console.log(`📊 FULL DATABASE AUDIT - OFFRAMP SYSTEM`);
  console.log(`${"=".repeat(100)}\n`);

  // Get ALL transactions
  const { data: transactions, error } = await supabaseAdmin
    .from('offramp_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ Database Error:', error);
    return;
  }

  if (!transactions || transactions.length === 0) {
    console.log('⚠️  No transactions found in database!\n');
    return;
  }

  console.log(`Found ${transactions.length} transaction(s):\n`);
  console.log(`${"=".repeat(100)}\n`);

  transactions.forEach((tx, i) => {
    const isActive = ['pending', 'token_received', 'swapping', 'usdc_received'].includes(tx.status);
    const statusEmoji = {
      'pending': '⏳',
      'token_received': '🟡',
      'swapping': '🔄',
      'usdc_received': '🟢',
      'paying': '💰',
      'completed': '✅',
      'failed': '❌',
      'refunded': '↩️'
    }[tx.status] || '❓';

    console.log(`${statusEmoji} #${i + 1}: ${tx.transaction_id}`);
    console.log(`${"─".repeat(100)}`);
    console.log(`   Status:              ${tx.status.toUpperCase()}`);
    console.log(`   User Email:          ${tx.user_email || '(none)'}`);
    console.log(`   User ID:             ${tx.user_id || '(none)'}`);
    console.log(`   Account Number:      ${tx.user_account_number || '(none)'}`);
    console.log(`   Wallet Address:      ${tx.unique_wallet_address}`);
    console.log(`   BaseScan:            https://basescan.org/address/${tx.unique_wallet_address}`);
    console.log(``);
    console.log(`   Token Address:       ${tx.token_address || '(not detected yet)'}`);
    console.log(`   Token Amount:        ${tx.token_amount || '(not detected yet)'}`);
    console.log(`   Token Amount Raw:    ${tx.token_amount_raw || '(not detected yet)'}`);
    console.log(``);
    console.log(`   Swap TX Hash:        ${tx.swap_tx_hash || '(not done yet)'}`);
    console.log(`   USDC Amount:         ${tx.usdc_amount || '(not swapped yet)'}`);
    console.log(`   USDC Amount Raw:     ${tx.usdc_amount_raw || '(not swapped yet)'}`);
    console.log(``);
    console.log(`   Created:             ${tx.created_at}`);
    console.log(`   Token Received At:   ${tx.token_received_at || '(not yet)'}`);
    console.log(`   Updated:             ${tx.updated_at}`);
    
    if (tx.error_message) {
      console.log(`   ❌ ERROR:            ${tx.error_message}`);
    }
    
    console.log(`\n`);
  });

  console.log(`${"=".repeat(100)}`);
  console.log(`\n📈 SUMMARY:\n`);

  const statusCounts = transactions.reduce((acc: any, tx) => {
    acc[tx.status] = (acc[tx.status] || 0) + 1;
    return acc;
  }, {});

  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });

  const activeTransactions = transactions.filter(tx => 
    ['pending', 'token_received', 'swapping', 'usdc_received'].includes(tx.status)
  );

  console.log(`\n   🔥 Active transactions: ${activeTransactions.length}`);
  
  if (activeTransactions.length > 0) {
    console.log(`\n   Active Transaction Details:`);
    activeTransactions.forEach(tx => {
      console.log(`      - ${tx.transaction_id}: ${tx.status} (User: ${tx.user_email || 'guest'})`);
    });
  }

  console.log(`\n${"=".repeat(100)}\n`);
}

fullAudit().catch(console.error);
