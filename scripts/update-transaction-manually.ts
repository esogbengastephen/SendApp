/**
 * Manually update transaction with token info
 */

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

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const TRANSACTION_ID = "offramp_5xXSFS-w56w-";
const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const SEND_AMOUNT = "5000000000000000000"; // 5 SEND (18 decimals)

async function updateTransaction() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`📝 UPDATING TRANSACTION WITH TOKEN INFO`);
  console.log(`${"=".repeat(80)}\n`);

  const { data, error } = await supabaseAdmin
    .from('offramp_transactions')
    .update({
      token_address: SEND_TOKEN,
      token_symbol: 'SEND',
      token_amount: '5',
      token_amount_raw: SEND_AMOUNT,
      all_tokens_detected: JSON.stringify([{
        address: SEND_TOKEN,
        symbol: 'SEND',
        amount: '5',
        amountRaw: SEND_AMOUNT,
        decimals: 18
      }]),
      updated_at: new Date().toISOString()
    })
    .eq('transaction_id', TRANSACTION_ID)
    .select();

  if (error) {
    console.log(`❌ Error: ${error.message}`);
    return;
  }

  console.log(`✅ Transaction updated successfully!`);
  console.log(`\nToken Info Set:`);
  console.log(`  Address: ${SEND_TOKEN}`);
  console.log(`  Symbol: SEND`);
  console.log(`  Amount: 5 SEND`);

  console.log(`\n${"=".repeat(80)}`);
  console.log(`🚀 READY TO SWAP!`);
  console.log(`${"=".repeat(80)}\n`);

  console.log(`Run the swap now:`);
  console.log(`\ncurl -X POST http://localhost:3000/api/offramp/swap-token \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"transactionId":"${TRANSACTION_ID}"}'`);
  console.log(``);
}

updateTransaction().catch(console.error);
