#!/usr/bin/env node

/**
 * Quick Database Fix Script
 * This displays the SQL you need to run in Supabase SQL Editor
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n' + '='.repeat(70));
console.log('🚀 DATABASE FIX - Copy & Paste This SQL');
console.log('='.repeat(70));
console.log('\n📋 STEP 1: Open Supabase SQL Editor');
console.log('   👉 https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new\n');
console.log('📋 STEP 2: Copy the SQL below (everything between the lines)\n');
console.log('─'.repeat(70));

const sqlPath = join(__dirname, 'QUICK_FIX.sql');
const sql = readFileSync(sqlPath, 'utf-8');

// Remove comments and show clean SQL
const cleanSQL = sql
  .split('\n')
  .filter(line => !line.trim().startsWith('--') || line.includes('Link:'))
  .join('\n');

console.log(cleanSQL);
console.log('─'.repeat(70));

console.log('\n📋 STEP 3: Paste into Supabase SQL Editor and click "Run"\n');
console.log('✅ That\'s it! Your database will be fixed.\n');
console.log('🧪 After running, test with:');
console.log('   node scripts/diagnose-auth-issue.js\n');
console.log('='.repeat(70) + '\n');

