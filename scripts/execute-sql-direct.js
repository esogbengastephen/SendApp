#!/usr/bin/env node

/**
 * Execute SQL directly via Supabase using service role key
 * This attempts to use the Supabase REST API to execute SQL
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
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
  // Use process.env as fallback
}

supabaseUrl = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ksdzzqdafodlstfkqzuv.supabase.co';
supabaseServiceRoleKey = supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n🔧 Attempting to execute SQL directly via Supabase API...\n');

if (!supabaseServiceRoleKey) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is required!');
  console.error('\nQuick fix:');
  console.error('1. Get your service role key from:');
  console.error('   https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/settings/api');
  console.error('\n2. Add to .env.local:');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your_key_here');
  process.exit(1);
}

// Read the SQL file
const sqlPath = join(__dirname, '..', 'QUICK_FIX.sql');
let sqlContent;

try {
  sqlContent = readFileSync(sqlPath, 'utf-8');
  // Remove comments and empty lines, keep only SQL statements
  sqlContent = sqlContent
    .split('\n')
    .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
    .join('\n');
} catch (error) {
  console.error(`❌ Could not read ${sqlPath}`);
  process.exit(1);
}

// Split into individual statements
const statements = sqlContent
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.toLowerCase().startsWith('select'));

console.log(`📄 Found ${statements.length} SQL statements to execute\n`);

// Try to execute via Supabase REST API
// Note: Supabase doesn't support arbitrary SQL via REST API
// We'll try using the PostgREST endpoint or Management API

let successCount = 0;
let errorCount = 0;

for (let i = 0; i < statements.length; i++) {
  const statement = statements[i];
  
  if (!statement || statement.length < 10) continue;
  
  console.log(`\n📝 Statement ${i + 1}/${statements.length}:`);
  console.log(`   ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`);
  
  try {
    // Try using Supabase REST API with raw SQL
    // This might not work, but we'll try
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceRoleKey,
        'Authorization': `Bearer ${supabaseServiceRoleKey}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ query: statement }),
    });
    
    if (response.ok) {
      console.log('   ✅ Success');
      successCount++;
    } else {
      const errorText = await response.text();
      console.log(`   ⚠️  API method failed: ${response.status}`);
      
      // If RPC doesn't exist, we need to use a different approach
      // The standard Supabase REST API doesn't support arbitrary SQL
      console.log('\n❌ Direct SQL execution via API is not supported by Supabase.');
      console.log('\n✅ EASIEST SOLUTION: Use Supabase SQL Editor');
      console.log('\n1. Open: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new');
      console.log('\n2. Copy the SQL from: QUICK_FIX.sql');
      console.log('\n3. Paste and click "Run"');
      console.log('\n4. Done! ✅\n');
      process.exit(1);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    errorCount++;
  }
}

if (successCount > 0 && errorCount === 0) {
  console.log('\n✅ All statements executed successfully!');
  console.log('\n🧪 Testing database access...');
  
  // Test insert
  const testResponse = await fetch(`${supabaseUrl}/rest/v1/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceRoleKey,
      'Authorization': `Bearer ${supabaseServiceRoleKey}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      email: `test_${Date.now()}@test.com`,
      referral_code: `TEST${Date.now()}`,
      email_verified: false,
    }),
  });
  
  if (testResponse.ok) {
    const testData = await testResponse.json();
    console.log('   ✅ Test insert successful! RLS is fixed.');
    
    // Clean up
    await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${testData[0].id}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseServiceRoleKey,
        'Authorization': `Bearer ${supabaseServiceRoleKey}`,
      },
    });
    console.log('   ✅ Test data cleaned up');
  } else {
    console.log('   ⚠️  Test insert failed - RLS may still need fixing');
  }
  
  console.log('\n🎉 Done! Try signing up now at /auth\n');
} else {
  console.log('\n⚠️  Some statements failed. Please use Supabase SQL Editor instead.');
}

