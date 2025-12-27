/**
 * Clean all offramp database tables and data
 * Run this after backup is complete
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function cleanDatabase() {
  console.log('\n' + '='.repeat(80));
  console.log('🧹 CLEANING OFFRAMP DATABASE');
  console.log('='.repeat(80) + '\n');

  try {
    // Delete in order (respecting foreign keys)
    console.log('🗑️  Deleting offramp_swap_attempts...');
    const { error: attemptsError } = await supabaseAdmin
      .from('offramp_swap_attempts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (attemptsError) {
      console.error('❌ Error deleting swap attempts:', attemptsError);
    } else {
      console.log('✅ Deleted all swap attempts');
    }

    console.log('🗑️  Deleting offramp_revenue...');
    const { error: revenueError } = await supabaseAdmin
      .from('offramp_revenue')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (revenueError) {
      console.error('❌ Error deleting revenue:', revenueError);
    } else {
      console.log('✅ Deleted all revenue records');
    }

    console.log('🗑️  Deleting offramp_transactions...');
    const { error: txError } = await supabaseAdmin
      .from('offramp_transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (txError) {
      console.error('❌ Error deleting transactions:', txError);
    } else {
      console.log('✅ Deleted all transactions');
    }

    // Note: We keep offramp_fee_tiers as they're configuration, not data

    console.log('\n' + '='.repeat(80));
    console.log('✅ DATABASE CLEANUP COMPLETE!');
    console.log('='.repeat(80));
    console.log('📊 Summary:');
    console.log('   - Deleted all offramp_transactions');
    console.log('   - Deleted all offramp_revenue');
    console.log('   - Deleted all offramp_swap_attempts');
    console.log('   - Kept offramp_fee_tiers (configuration)');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Fatal error during cleanup:', error);
    process.exit(1);
  }
}

cleanDatabase().catch(console.error);
