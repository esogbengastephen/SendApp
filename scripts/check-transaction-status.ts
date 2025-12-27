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

async function checkUserTransactions() {
  const userEmail = "esogbengastephen@gmail.com";
  
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 CHECKING TRANSACTIONS FOR: ${userEmail}`);
  console.log(`${"=".repeat(80)}\n`);

  const { data: transactions, error } = await supabaseAdmin
    .from('offramp_transactions')
    .select('*')
    .eq('user_email', userEmail.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!transactions || transactions.length === 0) {
    console.log('❌ No transactions found for this user');
    return;
  }

  console.log(`Found ${transactions.length} transaction(s):\n`);
  
  transactions.forEach((tx, i) => {
    console.log(`${i + 1}. Transaction ID: ${tx.transaction_id}`);
    console.log(`   Status: ${tx.status}`);
    console.log(`   Wallet: ${tx.unique_wallet_address}`);
    console.log(`   Created: ${tx.created_at}`);
    console.log(`   Email: ${tx.user_email}`);
    console.log(`   User ID: ${tx.user_id || '(null)'}`);
    console.log(`   Account: ${tx.user_account_number || '(null)'}`);
    console.log('');
  });
}

checkUserTransactions().catch(console.error);
