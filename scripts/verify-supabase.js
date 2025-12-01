#!/usr/bin/env node

/**
 * Supabase Database Verification Script
 * Verifies that the platform_settings table is set up correctly
 */

import { createClient } from '@supabase/supabase-js';

// Load from environment variable for security
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ksdzzqdafodlstfkqzuv.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.log('\nTo run this script:');
  console.log('  SUPABASE_SERVICE_ROLE_KEY=your_key_here node scripts/verify-supabase.js');
  console.log('\nOr add it to your .env.local file:');
  console.log('  SUPABASE_SERVICE_ROLE_KEY=your_key_here');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verifyDatabase() {
  console.log('🔍 Verifying Supabase Database Setup...\n');
  console.log('='.repeat(60));

  // 1. Check if table exists
  console.log('\n1️⃣ Checking if platform_settings table exists...');
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('*')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        console.log('❌ Table does not exist!');
        console.log('   Please run the migration script first.');
        console.log('   See: supabase/migrations/001_create_platform_settings.sql');
        return false;
      }
      throw error;
    }

    console.log('✅ Table exists!');
  } catch (error) {
    console.error('❌ Error checking table:', error.message);
    return false;
  }

  // 2. Check table structure
  console.log('\n2️⃣ Checking table structure...');
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('id, setting_key, setting_value, updated_at, updated_by, created_at')
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const row = data[0];
      console.log('✅ Table structure is correct');
      console.log('   Columns found:', Object.keys(row).join(', '));
    } else {
      console.log('⚠️  Table exists but has no data');
    }
  } catch (error) {
    console.error('❌ Error checking structure:', error.message);
    return false;
  }

  // 3. Check if exchange_rate setting exists
  console.log('\n3️⃣ Checking if exchange_rate setting exists...');
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('*')
      .eq('setting_key', 'exchange_rate')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      console.log('❌ Exchange rate setting not found!');
      console.log('   The migration may not have run, or the default was not inserted.');
      console.log('   This is okay - the app will create it on first use.');
      return true; // Not a critical error
    }

    console.log('✅ Exchange rate setting found!');
    console.log('   Setting Key:', data.setting_key);
    console.log('   Exchange Rate:', data.setting_value?.exchangeRate || 'N/A');
    console.log('   Updated At:', data.setting_value?.updatedAt || 'N/A');
    console.log('   Updated By:', data.setting_value?.updatedBy || data.updated_by || 'N/A');
    console.log('   DB Updated At:', data.updated_at);
    
    // Verify JSONB structure
    if (data.setting_value && typeof data.setting_value === 'object') {
      console.log('✅ JSONB structure is correct');
    } else {
      console.log('⚠️  JSONB structure may be incorrect');
    }
  } catch (error) {
    console.error('❌ Error checking exchange rate:', error.message);
    return false;
  }

  // 4. Test read access
  console.log('\n4️⃣ Testing read access...');
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'exchange_rate')
      .maybeSingle();

    if (error) throw error;

    if (data) {
      console.log('✅ Read access works!');
      console.log('   Current exchange rate:', data.setting_value?.exchangeRate || 'N/A');
    } else {
      console.log('⚠️  No data to read (this is okay if migration hasn\'t run)');
    }
  } catch (error) {
    console.error('❌ Read access failed:', error.message);
    return false;
  }

  // 5. Test write access (update)
  console.log('\n5️⃣ Testing write access...');
  try {
    // Get current rate first
    const { data: currentData } = await supabase
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'exchange_rate')
      .maybeSingle();

    const currentRate = currentData?.setting_value?.exchangeRate || 50;
    const testRate = currentRate === 50 ? 51 : 50; // Toggle between 50 and 51

    // Try to update
    const { data: updateData, error: updateError } = await supabase
      .from('platform_settings')
      .upsert({
        setting_key: 'exchange_rate',
        setting_value: {
          exchangeRate: testRate,
          updatedAt: new Date().toISOString(),
          updatedBy: 'verification-script'
        },
        updated_by: 'verification-script'
      }, {
        onConflict: 'setting_key'
      });

    if (updateError) throw updateError;

    console.log('✅ Write access works!');
    console.log(`   Updated rate to: ${testRate} (for testing)`);

    // Restore original rate
    if (currentData) {
      await supabase
        .from('platform_settings')
        .upsert({
          setting_key: 'exchange_rate',
          setting_value: {
            exchangeRate: currentRate,
            updatedAt: currentData.setting_value?.updatedAt || new Date().toISOString(),
            updatedBy: currentData.setting_value?.updatedBy || 'system'
          },
          updated_by: currentData.setting_value?.updatedBy || 'system'
        }, {
          onConflict: 'setting_key'
        });
      console.log(`   Restored original rate: ${currentRate}`);
    }
  } catch (error) {
    console.error('❌ Write access failed:', error.message);
    console.log('   This might be due to RLS policies. Check Row Level Security settings.');
    return false;
  }

  // 6. Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ Verification Complete!');
  console.log('\n📋 Summary:');
  console.log('   - Table exists: ✅');
  console.log('   - Structure correct: ✅');
  console.log('   - Exchange rate data: ✅');
  console.log('   - Read access: ✅');
  console.log('   - Write access: ✅');
  console.log('\n🎉 Your Supabase database is properly configured!');
  console.log('   The exchange rate will persist across server restarts.');
  
  return true;
}

// Run verification
verifyDatabase()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });

