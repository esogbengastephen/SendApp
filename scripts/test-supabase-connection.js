#!/usr/bin/env node

/**
 * Test Supabase Connection and Database Access
 * This script verifies that the Supabase anon key works and can access the database
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ksdzzqdafodlstfkqzuv.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzZHp6cWRhZm9kbHN0ZmtxenV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NzY2MTUsImV4cCI6MjA3OTI1MjYxNX0.jG-LPxPmwAfQMpcvTMsESDN0vXaiTbah3gS_uLs8XiE';

console.log('🔍 Testing Supabase Connection...\n');
console.log(`URL: ${supabaseUrl}`);
console.log(`Anon Key: ${supabaseAnonKey.substring(0, 20)}...\n`);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  const results = {
    connection: false,
    usersTable: false,
    confirmationCodesTable: false,
    canReadUsers: false,
    canInsertUsers: false,
    canReadCodes: false,
    canInsertCodes: false,
    errors: []
  };

  try {
    // Test 1: Check if we can connect
    console.log('1️⃣ Testing basic connection...');
    const { data: healthCheck, error: healthError } = await supabase
      .from('users')
      .select('count')
      .limit(0);
    
    if (healthError && healthError.code !== 'PGRST116') {
      results.errors.push(`Connection error: ${healthError.message}`);
      console.log('❌ Connection failed:', healthError.message);
    } else {
      results.connection = true;
      console.log('✅ Connection successful!\n');
    }

    // Test 2: Check if users table exists and is readable
    console.log('2️⃣ Testing users table access...');
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, email, referral_code')
      .limit(1);
    
    if (usersError) {
      if (usersError.code === '42P01') {
        results.errors.push('Users table does not exist. Run migration: 002_create_auth_tables.sql');
        console.log('❌ Users table does not exist');
      } else if (usersError.code === '42501' || usersError.message?.includes('policy')) {
        results.errors.push('RLS policy blocking read access. Run migration: 004_complete_rls_fix.sql');
        console.log('❌ RLS policy blocking read:', usersError.message);
      } else {
        results.errors.push(`Users table error: ${usersError.message}`);
        console.log('❌ Users table error:', usersError.message);
      }
    } else {
      results.usersTable = true;
      results.canReadUsers = true;
      console.log('✅ Users table is accessible (read)');
      console.log(`   Found ${usersData?.length || 0} users\n`);
    }

    // Test 3: Check if we can insert into users (test insert, then rollback)
    console.log('3️⃣ Testing users table write access...');
    const testEmail = `test_${Date.now()}@test.com`;
    const { data: insertData, error: insertError } = await supabase
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
    
    if (insertError) {
      if (insertError.code === '42501' || insertError.message?.includes('policy') || insertError.message?.includes('row-level security')) {
        results.errors.push('RLS policy blocking insert. Run migration: 004_complete_rls_fix.sql');
        console.log('❌ RLS policy blocking insert:', insertError.message);
      } else {
        results.errors.push(`Users insert error: ${insertError.message}`);
        console.log('❌ Users insert error:', insertError.message);
      }
    } else {
      results.canInsertUsers = true;
      console.log('✅ Users table is accessible (insert)');
      
      // Clean up test data
      await supabase.from('users').delete().eq('email', testEmail);
      console.log('   Test data cleaned up\n');
    }

    // Test 4: Check confirmation_codes table
    console.log('4️⃣ Testing confirmation_codes table access...');
    const { data: codesData, error: codesError } = await supabase
      .from('confirmation_codes')
      .select('id, email, code')
      .limit(1);
    
    if (codesError) {
      if (codesError.code === '42P01') {
        results.errors.push('Confirmation_codes table does not exist. Run migration: 002_create_auth_tables.sql');
        console.log('❌ Confirmation_codes table does not exist');
      } else if (codesError.code === '42501' || codesError.message?.includes('policy')) {
        results.errors.push('RLS policy blocking codes read. Run migration: 004_complete_rls_fix.sql');
        console.log('❌ RLS policy blocking codes read:', codesError.message);
      } else {
        results.errors.push(`Codes table error: ${codesError.message}`);
        console.log('❌ Codes table error:', codesError.message);
      }
    } else {
      results.confirmationCodesTable = true;
      results.canReadCodes = true;
      console.log('✅ Confirmation_codes table is accessible (read)');
      console.log(`   Found ${codesData?.length || 0} codes\n`);
    }

    // Test 5: Check if we can insert into confirmation_codes
    console.log('5️⃣ Testing confirmation_codes write access...');
    const testCodeEmail = `test_code_${Date.now()}@test.com`;
    const { data: codeInsertData, error: codeInsertError } = await supabase
      .from('confirmation_codes')
      .insert({
        email: testCodeEmail,
        code: '123456',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        used: false,
      })
      .select()
      .single();
    
    if (codeInsertError) {
      if (codeInsertError.code === '42501' || codeInsertError.message?.includes('policy') || codeInsertError.message?.includes('row-level security')) {
        results.errors.push('RLS policy blocking codes insert. Run migration: 004_complete_rls_fix.sql');
        console.log('❌ RLS policy blocking codes insert:', codeInsertError.message);
      } else {
        results.errors.push(`Codes insert error: ${codeInsertError.message}`);
        console.log('❌ Codes insert error:', codeInsertError.message);
      }
    } else {
      results.canInsertCodes = true;
      console.log('✅ Confirmation_codes table is accessible (insert)');
      
      // Clean up test data
      await supabase.from('confirmation_codes').delete().eq('email', testCodeEmail);
      console.log('   Test data cleaned up\n');
    }

  } catch (error) {
    results.errors.push(`Unexpected error: ${error.message}`);
    console.error('❌ Unexpected error:', error);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`Connection: ${results.connection ? '✅' : '❌'}`);
  console.log(`Users table exists: ${results.usersTable ? '✅' : '❌'}`);
  console.log(`Can read users: ${results.canReadUsers ? '✅' : '❌'}`);
  console.log(`Can insert users: ${results.canInsertUsers ? '✅' : '❌'}`);
  console.log(`Codes table exists: ${results.confirmationCodesTable ? '✅' : '❌'}`);
  console.log(`Can read codes: ${results.canReadCodes ? '✅' : '❌'}`);
  console.log(`Can insert codes: ${results.canInsertCodes ? '✅' : '❌'}`);

  if (results.errors.length > 0) {
    console.log('\n❌ ERRORS FOUND:');
    results.errors.forEach((error, i) => {
      console.log(`   ${i + 1}. ${error}`);
    });
  }

  const allPassed = results.connection && 
                    results.usersTable && 
                    results.canReadUsers && 
                    results.canInsertUsers &&
                    results.confirmationCodesTable &&
                    results.canReadCodes &&
                    results.canInsertCodes;

  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED! Your Supabase setup is working correctly.');
    process.exit(0);
  } else {
    console.log('⚠️  SOME TESTS FAILED. Please fix the issues above.');
    process.exit(1);
  }
}

testConnection().catch(console.error);

