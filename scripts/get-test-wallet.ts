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

async function getTestWallet() {
  const { data: tx } = await supabaseAdmin
    .from('offramp_transactions')
    .select('*')
    .eq('id', 'offramp_xL8Ofn5QzVyC')
    .single();

  console.log(`\n${"=".repeat(80)}`);
  console.log(`📍 TEST WALLET INFO`);
  console.log(`${"=".repeat(80)}\n`);
  
  if (tx) {
    console.log(`Wallet Address: ${tx.wallet_address}`);
    console.log(`Transaction ID: ${tx.id}`);
    console.log(`Status: ${tx.status}`);
    console.log(`\n${"=".repeat(80)}`);
    console.log(`\n📤 SEND YOUR 266.22 SEND TOKENS TO:`);
    console.log(`\n   ${tx.wallet_address}\n`);
    console.log(`${"=".repeat(80)}\n`);
  }
}

getTestWallet().catch(console.error);
