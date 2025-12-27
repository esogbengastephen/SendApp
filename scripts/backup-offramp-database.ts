/**
 * Backup all offramp database data before deletion
 * Run this before cleaning the database
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
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
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

interface BackupData {
  timestamp: string;
  offramp_transactions: any[];
  offramp_revenue: any[];
  offramp_swap_attempts: any[];
  offramp_fee_tiers: any[];
}

async function backupDatabase() {
  console.log('\n' + '='.repeat(80));
  console.log('📦 BACKING UP OFFRAMP DATABASE');
  console.log('='.repeat(80) + '\n');

  const backup: BackupData = {
    timestamp: new Date().toISOString(),
    offramp_transactions: [],
    offramp_revenue: [],
    offramp_swap_attempts: [],
    offramp_fee_tiers: [],
  };

  try {
    // Backup offramp_transactions
    console.log('📋 Backing up offramp_transactions...');
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('offramp_transactions')
      .select('*')
      .order('created_at', { ascending: true });

    if (txError) {
      console.error('❌ Error backing up transactions:', txError);
    } else {
      backup.offramp_transactions = transactions || [];
      console.log(`✅ Backed up ${backup.offramp_transactions.length} transactions`);
    }

    // Backup offramp_revenue
    console.log('💰 Backing up offramp_revenue...');
    const { data: revenue, error: revError } = await supabaseAdmin
      .from('offramp_revenue')
      .select('*')
      .order('created_at', { ascending: true });

    if (revError) {
      console.error('❌ Error backing up revenue:', revError);
    } else {
      backup.offramp_revenue = revenue || [];
      console.log(`✅ Backed up ${backup.offramp_revenue.length} revenue records`);
    }

    // Backup offramp_swap_attempts
    console.log('🔄 Backing up offramp_swap_attempts...');
    const { data: attempts, error: attError } = await supabaseAdmin
      .from('offramp_swap_attempts')
      .select('*')
      .order('created_at', { ascending: true });

    if (attError) {
      console.error('❌ Error backing up swap attempts:', attError);
    } else {
      backup.offramp_swap_attempts = attempts || [];
      console.log(`✅ Backed up ${backup.offramp_swap_attempts.length} swap attempts`);
    }

    // Backup offramp_fee_tiers (keep for reference, but we'll recreate)
    console.log('💳 Backing up offramp_fee_tiers...');
    const { data: feeTiers, error: feeError } = await supabaseAdmin
      .from('offramp_fee_tiers')
      .select('*')
      .order('min_amount', { ascending: true });

    if (feeError) {
      console.error('❌ Error backing up fee tiers:', feeError);
    } else {
      backup.offramp_fee_tiers = feeTiers || [];
      console.log(`✅ Backed up ${backup.offramp_fee_tiers.length} fee tiers`);
    }

    // Save backup to file
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `offramp-backup-${timestamp}.json`);
    
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf-8');

    console.log('\n' + '='.repeat(80));
    console.log('✅ BACKUP COMPLETE!');
    console.log('='.repeat(80));
    console.log(`📁 Backup saved to: ${backupFile}`);
    console.log(`📊 Summary:`);
    console.log(`   - Transactions: ${backup.offramp_transactions.length}`);
    console.log(`   - Revenue: ${backup.offramp_revenue.length}`);
    console.log(`   - Swap Attempts: ${backup.offramp_swap_attempts.length}`);
    console.log(`   - Fee Tiers: ${backup.offramp_fee_tiers.length}`);
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Fatal error during backup:', error);
    process.exit(1);
  }
}

backupDatabase().catch(console.error);
