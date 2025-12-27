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
const USER_EMAIL = "gasless-test@example.com";

async function fixIdentifier() {
  console.log(`\n🔧 FIXING user_identifier in database...\n`);

  const { data, error } = await supabaseAdmin
    .from('offramp_transactions')
    .update({
      user_identifier: USER_EMAIL,  // Use email as identifier
      updated_at: new Date().toISOString()
    })
    .eq('transaction_id', TRANSACTION_ID)
    .select();

  if (error) {
    console.log(`❌ Error: ${error.message}`);
    return;
  }

  console.log(`✅ Fixed! user_identifier now set to: ${USER_EMAIL}`);
  console.log(`\nUpdated record:`, data);
  console.log(`\n✅ Now try the swap again!\n`);
}

fixIdentifier().catch(console.error);
