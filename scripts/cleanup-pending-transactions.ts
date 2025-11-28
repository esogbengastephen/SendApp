/**
 * Cleanup Script: Remove Pending Transactions Older Than 1 Hour
 * 
 * Removes pending transactions that are older than 1 hour.
 * These are typically abandoned payment flows where users:
 * - Clicked "Generate Payment" but never paid
 * - Started payment process but abandoned it
 * - Payment was never completed
 * 
 * This helps keep the database clean and dashboard stats accurate.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
      const value = values.join('=').trim();
      process.env[key.trim()] = value;
    }
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables!');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  console.error(`Looking for .env.local at: ${envPath}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface Transaction {
  id: string;
  transaction_id: string;
  user_id: string | null;
  wallet_address: string;
  ngn_amount: string;
  send_amount: string;
  status: string;
  created_at: string;
  expires_at: string | null; // Timestamp when pending transaction expires
  paystack_reference: string | null;
}

async function findOldPendingTransactions() {
  console.log('🔍 Searching for expired pending transactions...\n');

  // Get all pending transactions where expires_at < NOW()
  // Each transaction has its own 1-hour timer
  const now = new Date().toISOString();

  const { data: oldPending, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('status', 'pending')
    .lt('expires_at', now)
    .order('expires_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching transactions:', error);
    throw error;
  }

  if (!oldPending || oldPending.length === 0) {
    console.log('✅ No expired pending transactions found.\n');
    return [];
  }

  console.log(`📊 Found ${oldPending.length} expired pending transactions\n`);

  return oldPending;
}

async function cleanupPending(dryRun: boolean = true) {
  console.log('🧹 PENDING TRANSACTION CLEANUP SCRIPT');
  console.log('==========================================\n');
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '⚠️  LIVE MODE (will delete)'}\n`);

  const oldPendingTransactions = await findOldPendingTransactions();

  if (oldPendingTransactions.length === 0) {
    console.log('✅ No cleanup needed!\n');
    return;
  }

  // Show breakdown by expiration time
  const now = Date.now();
  const ageGroups = {
    'Just expired (< 1h)': 0,
    '1-2 hours expired': 0,
    '2-6 hours expired': 0,
    '6-12 hours expired': 0,
    '12-24 hours expired': 0,
    '>24 hours expired': 0,
  };

  oldPendingTransactions.forEach((tx) => {
    const expiresAt = tx.expires_at ? new Date(tx.expires_at).getTime() : null;
    if (!expiresAt) {
      // Fallback for transactions without expires_at (shouldn't happen, but handle gracefully)
      ageGroups['Just expired (< 1h)']++;
      return;
    }
    
    const expiredAgo = now - expiresAt;
    const hours = expiredAgo / (1000 * 60 * 60);
    
    if (hours < 1) ageGroups['Just expired (< 1h)']++;
    else if (hours < 2) ageGroups['1-2 hours expired']++;
    else if (hours < 6) ageGroups['2-6 hours expired']++;
    else if (hours < 12) ageGroups['6-12 hours expired']++;
    else if (hours < 24) ageGroups['12-24 hours expired']++;
    else ageGroups['>24 hours expired']++;
  });

  console.log('📋 BREAKDOWN BY AGE');
  console.log('─'.repeat(60));
  Object.entries(ageGroups).forEach(([range, count]) => {
    if (count > 0) {
      console.log(`${range}: ${count} transactions`);
    }
  });
  console.log(`📊 Total to Remove: ${oldPendingTransactions.length}\n`);

  // Show sample transactions
  console.log('📄 SAMPLE TRANSACTIONS (first 10):');
  console.log('─'.repeat(60));
  
  oldPendingTransactions.slice(0, 10).forEach((tx, i) => {
    const amount = parseFloat(tx.ngn_amount);
    const wallet = tx.wallet_address || 'N/A';
    const expiresAt = tx.expires_at ? new Date(tx.expires_at) : null;
    const expiredAgo = expiresAt ? Math.round((Date.now() - expiresAt.getTime()) / 1000 / 60) : 0; // minutes
    
    console.log(`\n${i + 1}. ${tx.transaction_id}`);
    console.log(`   Amount: ₦${amount.toLocaleString()}`);
    console.log(`   Wallet: ${wallet.slice(0, 20)}${wallet.length > 20 ? '...' : ''}`);
    if (expiresAt) {
      console.log(`   Expired: ${expiredAgo < 60 ? `${expiredAgo} minutes` : `${Math.round(expiredAgo / 60)} hours`} ago`);
      console.log(`   Expired at: ${expiresAt.toLocaleString()}`);
    } else {
      console.log(`   Created: ${new Date(tx.created_at).toLocaleString()}`);
    }
    if (tx.paystack_reference) {
      console.log(`   Paystack Ref: ${tx.paystack_reference}`);
    }
  });

  if (oldPendingTransactions.length > 10) {
    console.log(`\n... and ${oldPendingTransactions.length - 10} more`);
  }

  // Summary
  console.log('\n\n📊 CLEANUP SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Expired pending transactions to delete: ${oldPendingTransactions.length}`);
  console.log(`Each transaction had its own 1-hour expiration timer`);
  console.log(`This will free up the database and improve dashboard accuracy`);

  // Execute deletion if not dry run
  if (!dryRun) {
    console.log('\n⚠️  EXECUTING DELETIONS...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const tx of oldPendingTransactions) {
      try {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('transaction_id', tx.transaction_id);

        if (error) {
          console.error(`❌ Failed to delete ${tx.transaction_id}:`, error.message);
          errorCount++;
        } else {
          console.log(`✅ Deleted: ${tx.transaction_id} (₦${parseFloat(tx.ngn_amount).toLocaleString()})`);
          successCount++;
        }
      } catch (err: any) {
        console.error(`❌ Error deleting ${tx.transaction_id}:`, err.message);
        errorCount++;
      }
    }

    console.log('\n\n🎉 CLEANUP COMPLETE!');
    console.log('═'.repeat(60));
    console.log(`✅ Successfully deleted: ${successCount} transactions`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`\nYour database is now cleaner! 🎯`);
    
    // Show new stats
    const { data: remaining } = await supabase
      .from('transactions')
      .select('status');
    
    if (remaining) {
      const stats = {
        total: remaining.length,
        pending: remaining.filter(t => t.status === 'pending').length,
        completed: remaining.filter(t => t.status === 'completed').length,
        failed: remaining.filter(t => t.status === 'failed').length,
      };
      
      console.log('\n📊 NEW TRANSACTION STATS');
      console.log('═'.repeat(60));
      console.log(`Total: ${stats.total}`);
      console.log(`Pending: ${stats.pending} (all active, not expired)`);
      console.log(`Completed: ${stats.completed}`);
      console.log(`Failed: ${stats.failed}\n`);
    }
  } else {
    console.log('\n\n💡 DRY RUN COMPLETE - No changes made');
    console.log('═'.repeat(60));
    console.log('To execute the cleanup for real, run:');
    console.log('  npm run cleanup-pending -- --execute\n');
  }
}

// Main execution
const args = process.argv.slice(2);
const isExecute = args.includes('--execute');

cleanupPending(!isExecute)
  .then(() => {
    console.log('\n✨ Script finished successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

