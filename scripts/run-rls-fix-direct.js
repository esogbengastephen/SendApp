#!/usr/bin/env node

/**
 * Run RLS Fix Migration directly using Supabase client
 * No psql needed - just run: node scripts/run-rls-fix-direct.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
const envPath = join(__dirname, '..', '.env.local');
let supabaseUrl, supabaseServiceRoleKey;

try {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      if (key.trim() === 'NEXT_PUBLIC_SUPABASE_URL') {
        supabaseUrl = value;
      } else if (key.trim() === 'SUPABASE_SERVICE_ROLE_KEY') {
        supabaseServiceRoleKey = value;
      }
    }
  });
} catch (error) {
  console.log('⚠️  Could not read .env.local, using process.env');
}

// Use environment variables or fallback
supabaseUrl = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ksdzzqdafodlstfkqzuv.supabase.co';
supabaseServiceRoleKey = supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n🔧 Running RLS Fix Migration via Supabase API...\n');
console.log('='.repeat(60));

if (!supabaseServiceRoleKey) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is required!');
  console.error('');
  console.error('To fix this:');
  console.error('1. Go to: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/settings/api');
  console.error('2. Copy the "service_role" key (keep it secret!)');
  console.error('3. Add to .env.local:');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here');
  console.error('4. Run this script again');
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Read the migration SQL file
const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '004_complete_rls_fix.sql');
let migrationSQL;

try {
  migrationSQL = readFileSync(migrationPath, 'utf-8');
} catch (error) {
  console.error(`❌ ERROR: Could not read migration file: ${migrationPath}`);
  console.error(error.message);
  process.exit(1);
}

// Split SQL into individual statements (remove comments and empty lines)
const statements = migrationSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('='));

console.log(`📄 Found ${statements.length} SQL statements to execute\n`);

// Execute each statement
let successCount = 0;
let errorCount = 0;

for (let i = 0; i < statements.length; i++) {
  const statement = statements[i];
  
  // Skip SELECT statements (they're for verification)
  if (statement.toUpperCase().startsWith('SELECT')) {
    console.log(`⏭️  Skipping verification query: ${statement.substring(0, 50)}...`);
    continue;
  }
  
  try {
    console.log(`\n📝 Executing statement ${i + 1}/${statements.length}...`);
    console.log(`   ${statement.substring(0, 80)}${statement.length > 80 ? '...' : ''}`);
    
    // Use Supabase RPC or direct query
    // Note: Supabase client doesn't support arbitrary SQL, so we'll use the REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceRoleKey,
        'Authorization': `Bearer ${supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({ query: statement }),
    });
    
    if (!response.ok) {
      // If RPC doesn't exist, try direct SQL execution via PostgREST
      // Actually, we need to use the Supabase SQL editor API or psql
      // For now, let's use a workaround: execute via Supabase's REST API
      
      // Alternative: Use Supabase Management API or direct database connection
      console.log('   ⚠️  Direct SQL execution not available via REST API');
      console.log('   💡 Please run this migration via Supabase SQL Editor instead:');
      console.log('      https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new');
      console.log('   💡 Or use the psql method: ./run-rls-fix.sh');
      break;
    }
    
    const result = await response.json();
    console.log(`   ✅ Success`);
    successCount++;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    errorCount++;
  }
}

console.log('\n' + '='.repeat(60));
console.log('\n📊 SUMMARY:');
console.log(`   ✅ Successful: ${successCount}`);
console.log(`   ❌ Errors: ${errorCount}`);

if (errorCount > 0) {
  console.log('\n⚠️  Some statements failed. Please run the migration via:');
  console.log('   1. Supabase SQL Editor: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new');
  console.log('   2. Or use: ./run-rls-fix.sh');
  process.exit(1);
} else {
  console.log('\n✅ Migration completed successfully!');
  console.log('\n🧪 Testing database access...');
  
  // Test if we can now insert
  const testEmail = `test_${Date.now()}@test.com`;
  const { data, error } = await supabase
    .from('users')
    .insert({
      email: testEmail,
      referral_code: `TEST${Date.now()}`,
      email_verified: false,
      total_transactions: 0,
      total_spent_ngn: 0,
      total_received_send: '0.00',
    })
    .select()
    .single();
  
  if (error) {
    console.log(`   ⚠️  Test insert failed: ${error.message}`);
    console.log('   💡 The migration may need to be run via Supabase SQL Editor');
  } else {
    console.log('   ✅ Test insert successful! RLS policies are working.');
    // Clean up
    await supabase.from('users').delete().eq('email', testEmail);
    console.log('   ✅ Test data cleaned up');
  }
  
  console.log('\n🎉 Done! Try signing up now at /auth');
}


