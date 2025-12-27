import { generateUserOfframpWallet } from '../lib/offramp-wallet';
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

const TRANSACTION_ID = "offramp_5xXSFS-w56w-";

async function checkMatch() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 CHECKING WALLET ADDRESS MATCH`);
  console.log(`${"=".repeat(80)}\n`);

  // Get transaction from DB
  const { data: tx } = await supabaseAdmin
    .from('offramp_transactions')
    .select('*')
    .eq('transaction_id', TRANSACTION_ID)
    .single();

  if (!tx) {
    console.log(`❌ Transaction not found`);
    return;
  }

  console.log(`DB Record:`);
  console.log(`  Transaction ID: ${tx.transaction_id}`);
  console.log(`  Wallet Address: ${tx.unique_wallet_address}`);
  console.log(`  User ID: ${tx.user_id}`);
  console.log(`  User Email: ${tx.user_email}`);
  console.log(`  User Identifier: ${tx.user_identifier}\n`);

  // Generate wallet from user_identifier
  if (tx.user_identifier) {
    const generatedWallet = generateUserOfframpWallet(tx.user_identifier);
    console.log(`Generated Wallet:`);
    console.log(`  Address: ${generatedWallet.address}\n`);

    if (generatedWallet.address.toLowerCase() === tx.unique_wallet_address.toLowerCase()) {
      console.log(`✅ MATCH! Wallets are the same.`);
    } else {
      console.log(`❌ MISMATCH! This is the problem!`);
      console.log(`   DB has: ${tx.unique_wallet_address}`);
      console.log(`   Generated: ${generatedWallet.address}`);
    }
  }

  console.log(`\n${"=".repeat(80)}\n`);
}

checkMatch().catch(console.error);
