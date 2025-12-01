#!/usr/bin/env node

/**
 * Diagnostic script to check authentication setup
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '..', '.env.local');
try {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      process.env[key.trim()] = value;
    }
  });
} catch (error) {
  console.log('⚠️  .env.local not found, using process.env');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ksdzzqdafodlstfkqzuv.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n🔍 AUTHENTICATION DIAGNOSTIC\n');
console.log('='.repeat(50));

// Check environment variables
console.log('\n1️⃣ Environment Variables:');
console.log(`   SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
console.log(`   NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ Set (' + supabaseAnonKey.substring(0, 20) + '...)' : '❌ Missing'}`);
console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceRoleKey ? '✅ Set' : '❌ Missing (will use anon key)'}`);

if (!supabaseAnonKey) {
  console.log('\n❌ ERROR: NEXT_PUBLIC_SUPABASE_ANON_KEY is required!');
  process.exit(1);
}

// Create clients
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = supabaseServiceRoleKey && !supabaseServiceRoleKey.includes('placeholder')
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : supabase;

console.log('\n2️⃣ Testing Database Access:');

// Test 1: Check if users table exists and is readable
try {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .limit(1);
  
  if (error) {
    if (error.code === '42P01') {
      console.log('   ❌ Users table does not exist');
      console.log('   💡 Run: supabase/migrations/002_create_auth_tables.sql');
    } else if (error.code === '42501' || error.message?.includes('policy')) {
      console.log('   ⚠️  Users table exists but RLS is blocking read');
      console.log('   💡 Run: supabase/migrations/004_complete_rls_fix.sql');
    } else {
      console.log(`   ❌ Error reading users table: ${error.message}`);
    }
  } else {
    console.log('   ✅ Users table is accessible (read)');
  }
} catch (error) {
  console.log(`   ❌ Exception: ${error.message}`);
}

// Test 2: Check if we can insert (using admin client)
const isUsingServiceRole = supabaseServiceRoleKey && !supabaseServiceRoleKey.includes('placeholder');
console.log(`   Using service role key: ${isUsingServiceRole ? '✅ Yes' : '❌ No (using anon key)'}`);

try {
  const testEmail = `test_${Date.now()}@diagnostic.com`;
  const { data, error } = await supabaseAdmin
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
    console.log(`   ❌ Cannot insert into users table: ${error.message}`);
    console.log(`   Error code: ${error.code || 'undefined'}`);
    console.log(`   Full error:`, JSON.stringify(error, null, 2));
    
    // Check for RLS errors (even if error code is undefined)
    const isRLSError = error.code === '42501' || 
                      error.message?.includes('policy') || 
                      error.message?.includes('row-level security') ||
                      error.message?.includes('new row violates row-level security') ||
                      (!isUsingServiceRole && error.message?.includes('Invalid API key'));
    
    if (isRLSError) {
      console.log('   💡 This is an RLS policy error.');
      console.log('   💡 Solution 1: Run RLS fix migration');
      console.log('      → Go to: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new');
      console.log('      → Copy SQL from: supabase/migrations/004_complete_rls_fix.sql');
      console.log('      → Paste and click "Run"');
      console.log('');
      console.log('   💡 Solution 2: Add service role key to .env.local');
      console.log('      → Get key from: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/settings/api');
      console.log('      → Add: SUPABASE_SERVICE_ROLE_KEY=your_key_here');
      console.log('      → Restart server');
    } else if (error.message?.includes('Invalid API key') && isUsingServiceRole) {
      console.log('   💡 Service role key might be invalid.');
      console.log('   💡 Check SUPABASE_SERVICE_ROLE_KEY in .env.local');
    } else {
      console.log('   💡 Check the error details above for more information');
    }
  } else {
    console.log('   ✅ Users table is accessible (insert)');
    // Clean up test data
    await supabaseAdmin.from('users').delete().eq('email', testEmail);
    console.log('   ✅ Test data cleaned up');
  }
} catch (error) {
  console.log(`   ❌ Exception: ${error.message}`);
  console.log(`   Stack: ${error.stack}`);
}

// Test 3: Check confirmation_codes table
try {
  const { data, error } = await supabase
    .from('confirmation_codes')
    .select('id')
    .limit(1);
  
  if (error) {
    if (error.code === '42P01') {
      console.log('   ❌ Confirmation_codes table does not exist');
      console.log('   💡 Run: supabase/migrations/002_create_auth_tables.sql');
    } else {
      console.log(`   ❌ Error reading confirmation_codes: ${error.message}`);
    }
  } else {
    console.log('   ✅ Confirmation_codes table is accessible');
  }
} catch (error) {
  console.log(`   ❌ Exception: ${error.message}`);
}

console.log('\n' + '='.repeat(50));
console.log('\n📋 SUMMARY:');
console.log('   Check the errors above and follow the suggested fixes.');
console.log('   Most common issue: RLS policies blocking access.');
console.log('   Solution: Run supabase/migrations/004_complete_rls_fix.sql\n');

