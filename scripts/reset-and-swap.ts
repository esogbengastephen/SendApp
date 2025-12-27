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

async function reset() {
  console.log(`\n🔄 Resetting transaction status...`);

  const { error } = await supabaseAdmin
    .from('offramp_transactions')
    .update({ 
      status: 'pending',
      error_message: null,
      updated_at: new Date().toISOString()
    })
    .eq('transaction_id', TRANSACTION_ID);

  if (error) {
    console.log(`❌ Error: ${error.message}`);
    return;
  }

  console.log(`✅ Status reset!`);
  console.log(`\nNow triggering swap...\n`);

  // Trigger the swap
  try {
    const response = await fetch('http://localhost:3000/api/offramp/swap-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId: TRANSACTION_ID })
    });

    const result = await response.json();
    
    console.log(`\n${"=".repeat(80)}`);
    console.log(`SWAP RESULT`);
    console.log(`${"=".repeat(80)}\n`);
    console.log(JSON.stringify(result, null, 2));
    console.log(``);
    
  } catch (error: any) {
    console.log(`❌ Error triggering swap: ${error.message}`);
  }
}

reset().catch(console.error);
