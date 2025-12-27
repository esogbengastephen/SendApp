import { createClient } from '@supabase/supabase-js';
import { generateUserOfframpWallet } from '../lib/offramp-wallet';
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

const TRANSACTION_ID = "offramp_xL80rf5QzVyC";

async function diagnose() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 DIAGNOSING WALLET MISMATCH`);
  console.log(`${"=".repeat(80)}\n`);

  const { data: tx } = await supabaseAdmin
    .from('offramp_transactions')
    .select('*')
    .eq('transaction_id', TRANSACTION_ID)
    .single();

  if (!tx) {
    console.log(`❌ Transaction not found`);
    return;
  }

  console.log(`Transaction from DB:`);
  console.log(`  Transaction ID: ${tx.transaction_id}`);
  console.log(`  Wallet in DB: ${tx.unique_wallet_address}`);
  console.log(`  User ID: ${tx.user_id || 'null'}`);
  console.log(`  User Email: ${tx.user_email || 'null'}`);
  console.log(`  Account Number: ${tx.user_account_number || 'null'}\n`);

  // Test different identifier combinations
  const identifiers = [
    { name: 'user_id', value: tx.user_id },
    { name: 'user_email', value: tx.user_email },
    { name: 'guest_account', value: `guest_${tx.user_account_number}` }
  ];

  console.log(`Testing wallet generation with different identifiers:\n`);

  for (const { name, value } of identifiers) {
    if (!value) {
      console.log(`❌ ${name}: (null) - skipped`);
      continue;
    }

    try {
      const wallet = generateUserOfframpWallet(value);
      const matches = wallet.address.toLowerCase() === tx.unique_wallet_address.toLowerCase();
      
      console.log(`${matches ? '✅' : '❌'} ${name}: ${value}`);
      console.log(`   Generated: ${wallet.address}`);
      console.log(`   ${matches ? 'MATCH!' : 'No match'}\n`);

      if (matches) {
        console.log(`${"=".repeat(80)}`);
        console.log(`🎯 FOUND THE CORRECT IDENTIFIER!`);
        console.log(`${"=".repeat(80)}`);
        console.log(`\nThe wallet was created using: ${name} = "${value}"`);
        console.log(`But swap-token API is using: transaction.user_id || transaction.user_email || guest_${tx.user_account_number}`);
        console.log(`\nThis is causing the mismatch!\n`);
        return;
      }
    } catch (error: any) {
      console.log(`❌ ${name}: Error - ${error.message}\n`);
    }
  }

  console.log(`${"=".repeat(80)}`);
  console.log(`⚠️  NO MATCH FOUND WITH ANY IDENTIFIER!`);
  console.log(`${"=".repeat(80)}\n`);
}

diagnose().catch(console.error);
