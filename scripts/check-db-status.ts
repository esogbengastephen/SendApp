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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const TRANSACTION_ID = "offramp_5xXSFS-w56w-";

async function checkStatus() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`📊 TRANSACTION DATABASE STATUS`);
  console.log(`${"=".repeat(80)}\n`);

  const { data, error } = await supabaseAdmin
    .from('offramp_transactions')
    .select('*')
    .eq('transaction_id', TRANSACTION_ID)
    .single();

  if (error) {
    console.log(`❌ Error: ${error.message}`);
    return;
  }

  if (!data) {
    console.log(`❌ Transaction not found!`);
    return;
  }

  console.log(`Transaction ID: ${data.transaction_id}`);
  console.log(`Status: ${data.status}`);
  console.log(`Token Address: ${data.token_address || 'Not set'}`);
  console.log(`Token Amount: ${data.token_amount || 'Not set'}`);
  console.log(`Token Symbol: ${data.token_symbol || 'Not set'}`);
  console.log(`\nSwap Hash: ${data.swap_hash || 'Not executed'}`);
  console.log(`USDC Transfer Hash: ${data.usdc_transfer_hash || 'Not executed'}`);
  console.log(`USDC Amount: ${data.usdc_amount || 'Not set'}`);
  console.log(`\nError Message: ${data.error_message || 'None'}`);

  console.log(`\n${"=".repeat(80)}`);

  if (data.status === 'swap_failed' || data.status === 'error') {
    console.log(`⚠️  SWAP FAILED!`);
    console.log(`\nError: ${data.error_message}`);
    console.log(`\nResetting status to allow retry...`);

    const { error: updateError } = await supabaseAdmin
      .from('offramp_transactions')
      .update({ 
        status: 'pending',
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('transaction_id', TRANSACTION_ID);

    if (updateError) {
      console.log(`❌ Reset failed: ${updateError.message}`);
    } else {
      console.log(`✅ Status reset! Try swap again.`);
    }
  } else if (data.status === 'completed') {
    console.log(`✅ SWAP COMPLETED!`);
  } else {
    console.log(`Status: ${data.status}`);
    console.log(`Ready to test: ${data.token_address ? 'YES' : 'NO (token info missing)'}`);
  }

  console.log(`\n${"=".repeat(80)}\n`);
}

checkStatus().catch(console.error);
