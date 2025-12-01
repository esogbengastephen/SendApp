#!/usr/bin/env node

/**
 * Database Migration Script
 * Runs the platform_settings table migration using Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ksdzzqdafodlstfkqzuv.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is required');
  console.log('\nTo get your service role key:');
  console.log('1. Go to your Supabase project dashboard');
  console.log('2. Navigate to Settings > API');
  console.log('3. Copy the "service_role" key (not the anon key)');
  console.log('4. Add it to your .env.local file as: SUPABASE_SERVICE_ROLE_KEY=your_key_here\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 Starting database migration...\n');

  const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '001_create_platform_settings.sql');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  try {
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Executing ${statements.length} SQL statements...\n`);

    // Execute each statement using Supabase RPC (if available) or direct query
    // Note: Supabase client doesn't support raw SQL directly, so we'll use the REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ sql_query: sql })
    });

    if (!response.ok) {
      // If RPC doesn't exist, try alternative method
      console.log('⚠️  Direct SQL execution not available via RPC.');
      console.log('📋 Please run the migration manually in Supabase SQL Editor:\n');
      console.log('1. Go to: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new');
      console.log('2. Copy and paste the SQL from: supabase/migrations/001_create_platform_settings.sql');
      console.log('3. Click "Run" to execute\n');
      
      // Show the SQL content
      console.log('SQL to execute:');
      console.log('─'.repeat(60));
      console.log(sql);
      console.log('─'.repeat(60));
      return;
    }

    const result = await response.json();
    console.log('✅ Migration completed successfully!');
    console.log('Result:', result);

    // Verify the table was created
    const { data, error } = await supabase
      .from('platform_settings')
      .select('*')
      .limit(1);

    if (error) {
      console.error('⚠️  Warning: Could not verify table creation:', error.message);
    } else {
      console.log('✅ Verified: platform_settings table exists');
      if (data && data.length > 0) {
        console.log('✅ Verified: Default exchange rate setting exists');
      }
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n📋 Please run the migration manually in Supabase SQL Editor:');
    console.log('1. Go to: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new');
    console.log('2. Copy and paste the SQL from: supabase/migrations/001_create_platform_settings.sql');
    console.log('3. Click "Run" to execute\n');
    process.exit(1);
  }
}

runMigration();

