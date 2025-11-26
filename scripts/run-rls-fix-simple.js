#!/usr/bin/env node

/**
 * Simple script to run RLS fix via Supabase SQL Editor API
 * This uses the Supabase Management API to execute SQL
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n🔧 Running RLS Fix Migration...\n');

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

if (!supabaseServiceRoleKey) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is required!');
  console.error('');
  console.error('Quick fix:');
  console.error('1. Get your service role key from:');
  console.error('   https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/settings/api');
  console.error('');
  console.error('2. Add to .env.local:');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your_key_here');
  console.error('');
  console.error('3. Run this script again:');
  console.error('   node scripts/run-rls-fix-simple.js');
  process.exit(1);
}

// Read migration SQL
const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '004_complete_rls_fix.sql');
const migrationSQL = readFileSync(migrationPath, 'utf-8');

console.log('📄 Migration SQL loaded');
console.log('🚀 Executing via Supabase API...\n');

// The Supabase JavaScript client doesn't support arbitrary SQL execution
// We need to use the REST API directly or the Management API
// For now, let's provide clear instructions

console.log('⚠️  Direct SQL execution via API is not available.');
console.log('');
console.log('✅ EASIEST SOLUTION: Use Supabase SQL Editor (takes 30 seconds)');
console.log('');
console.log('1. Open this link:');
console.log('   https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new');
console.log('');
console.log('2. Copy the SQL below and paste it:');
console.log('');
console.log('─'.repeat(60));
console.log(migrationSQL);
console.log('─'.repeat(60));
console.log('');
console.log('3. Click "Run" button');
console.log('');
console.log('4. Done! ✅');
console.log('');
console.log('Alternative: If you have psql installed, run:');
console.log('   ./run-rls-fix.sh');


