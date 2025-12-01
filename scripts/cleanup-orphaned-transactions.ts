/**
 * Cleanup Script: Remove Orphaned/Incomplete Transactions
 * 
 * Removes broken transactions that were created but never completed:
 * - ₦0 amounts (never initialized)
 * - Empty/null wallet addresses
 * - Old pending transactions (>24 hours)
 * 
 * These are "ghost" transactions from incomplete payment flows
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
}

async function findOrphanedTransactions() {
  console.log('🔍 Searching for orphaned transactions...\n');

  // Get all pending transactions
  const { data: allPending, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching transactions:', error);
    throw error;
  }

  if (!allPending || allPending.length === 0) {
    console.log('No pending transactions found.');
    return [];
  }

  console.log(`📊 Total pending transactions: ${allPending.length}`);

  const orphaned: Transaction[] = [];
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const tx of allPending) {
    const amount = parseFloat(tx.ngn_amount);
    const wallet = tx.wallet_address?.trim() || '';
    const createdAt = new Date(tx.created_at);
    const isOld = createdAt < oneDayAgo;

    // Identify orphaned transactions
    const isOrphaned = 
      amount === 0 || // ₦0 amount
      !wallet || // No wallet address
      wallet === '' || // Empty wallet
      wallet === '...' || // Placeholder wallet
      (isOld && amount < 50); // Old and very small amount (likely test)

    if (isOrphaned) {
      orphaned.push(tx);
    }
  }

  return orphaned;
}

async function cleanupOrphaned(dryRun: boolean = true) {
  console.log('🧹 ORPHANED TRANSACTION CLEANUP SCRIPT');
  console.log('==========================================\n');
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '⚠️  LIVE MODE (will delete)'}\n`);

  const orphanedTransactions = await findOrphanedTransactions();

  if (orphanedTransactions.length === 0) {
    console.log('✅ No orphaned transactions found!\n');
    return;
  }

  console.log(`\n🔍 Found ${orphanedTransactions.length} orphaned transactions:\n`);

  // Categorize orphaned transactions
  const categories = {
    zeroAmount: orphanedTransactions.filter(tx => parseFloat(tx.ngn_amount) === 0),
    noWallet: orphanedTransactions.filter(tx => !tx.wallet_address || tx.wallet_address.trim() === '' || tx.wallet_address === '...'),
    oldPending: orphanedTransactions.filter(tx => {
      const age = Date.now() - new Date(tx.created_at).getTime();
      return age > 24 * 60 * 60 * 1000 && parseFloat(tx.ngn_amount) > 0;
    }),
  };

  // Show breakdown
  console.log('📋 BREAKDOWN BY TYPE');
  console.log('─'.repeat(60));
  console.log(`💰 Zero Amount (₦0): ${categories.zeroAmount.length}`);
  console.log(`📍 Missing Wallet: ${categories.noWallet.length}`);
  console.log(`⏰ Old Pending (>24h): ${categories.oldPending.length}`);
  console.log(`📊 Total to Remove: ${orphanedTransactions.length}\n`);

  // Show sample transactions
  console.log('📄 SAMPLE ORPHANED TRANSACTIONS (first 10):');
  console.log('─'.repeat(60));
  
  orphanedTransactions.slice(0, 10).forEach((tx, i) => {
    const amount = parseFloat(tx.ngn_amount);
    const wallet = tx.wallet_address || 'N/A';
    const age = Math.round((Date.now() - new Date(tx.created_at).getTime()) / 1000 / 60); // minutes
    
    console.log(`\n${i + 1}. ${tx.transaction_id}`);
    console.log(`   Amount: ₦${amount.toLocaleString()}`);
    console.log(`   Wallet: ${wallet.slice(0, 20)}${wallet.length > 20 ? '...' : ''}`);
    console.log(`   Age: ${age < 60 ? `${age} minutes` : `${Math.round(age / 60)} hours`} ago`);
    console.log(`   Created: ${new Date(tx.created_at).toLocaleString()}`);
  });

  if (orphanedTransactions.length > 10) {
    console.log(`\n... and ${orphanedTransactions.length - 10} more`);
  }

  // Summary
  console.log('\n\n📊 CLEANUP SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Orphaned transactions to delete: ${orphanedTransactions.length}`);
  console.log(`This will free up the database and fix dashboard stats`);

  // Execute deletion if not dry run
  if (!dryRun) {
    console.log('\n⚠️  EXECUTING DELETIONS...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const tx of orphanedTransactions) {
      try {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('transaction_id', tx.transaction_id);

        if (error) {
          console.error(`❌ Failed to delete ${tx.transaction_id}:`, error.message);
          errorCount++;
        } else {
          console.log(`✅ Deleted: ${tx.transaction_id}`);
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
    console.log(`\nYour dashboard stats should now be accurate! 🎯`);
    
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
      console.log(`Pending: ${stats.pending}`);
      console.log(`Completed: ${stats.completed}`);
      console.log(`Failed: ${stats.failed}\n`);
    }
  } else {
    console.log('\n\n💡 DRY RUN COMPLETE - No changes made');
    console.log('═'.repeat(60));
    console.log('To execute the cleanup for real, run:');
    console.log('  npm run cleanup-orphaned -- --execute\n');
  }
}

// Main execution
const args = process.argv.slice(2);
const isExecute = args.includes('--execute');

cleanupOrphaned(!isExecute)
  .then(() => {
    console.log('\n✨ Script finished successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

