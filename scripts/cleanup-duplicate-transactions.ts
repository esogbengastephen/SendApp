/**
 * Cleanup Script: Merge Duplicate Transactions
 * 
 * Finds and removes duplicate transactions where a user has both:
 * - A PENDING transaction (from "Generate Payment")
 * - A COMPLETED transaction (from webhook)
 * 
 * For the same wallet address and similar amount
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables!');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
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
  completed_at: string | null;
  tx_hash: string | null;
  paystack_reference: string | null;
}

interface DuplicateGroup {
  user_id: string | null;
  wallet_address: string;
  ngn_amount: string;
  transactions: Transaction[];
  pending: Transaction[];
  completed: Transaction[];
}

async function findDuplicateTransactions(): Promise<DuplicateGroup[]> {
  console.log('🔍 Searching for duplicate transactions...\n');

  // Get all transactions
  const { data: allTransactions, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching transactions:', error);
    throw error;
  }

  if (!allTransactions || allTransactions.length === 0) {
    console.log('No transactions found.');
    return [];
  }

  console.log(`📊 Total transactions: ${allTransactions.length}`);

  // Group transactions by user_id + wallet_address + ngn_amount
  const groups = new Map<string, Transaction[]>();

  for (const tx of allTransactions) {
    // Create a key for grouping (handle null user_id)
    const key = `${tx.user_id || 'null'}_${tx.wallet_address.toLowerCase()}_${parseFloat(tx.ngn_amount).toFixed(2)}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(tx);
  }

  // Find groups with duplicates (has both pending and completed)
  const duplicateGroups: DuplicateGroup[] = [];

  for (const [key, transactions] of groups.entries()) {
    if (transactions.length < 2) continue;

    const pending = transactions.filter(tx => tx.status === 'pending');
    const completed = transactions.filter(tx => tx.status === 'completed');

    // Check if we have both pending and completed (likely duplicates)
    if (pending.length > 0 && completed.length > 0) {
      // Also check if they were created within 30 minutes of each other
      const timeDiff = Math.abs(
        new Date(completed[0].created_at).getTime() - 
        new Date(pending[0].created_at).getTime()
      ) / 1000 / 60; // minutes

      if (timeDiff <= 30) {
        duplicateGroups.push({
          user_id: transactions[0].user_id,
          wallet_address: transactions[0].wallet_address,
          ngn_amount: transactions[0].ngn_amount,
          transactions,
          pending,
          completed,
        });
      }
    }
  }

  return duplicateGroups;
}

async function cleanupDuplicates(dryRun: boolean = true) {
  console.log('🧹 DUPLICATE TRANSACTION CLEANUP SCRIPT');
  console.log('==========================================\n');
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '⚠️  LIVE MODE (will delete)'}\n`);

  const duplicateGroups = await findDuplicateTransactions();

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicate transactions found!\n');
    return;
  }

  console.log(`\n🔍 Found ${duplicateGroups.length} duplicate groups:\n`);

  let totalPendingToDelete = 0;
  const deletionList: string[] = [];

  // Analyze each duplicate group
  for (let i = 0; i < duplicateGroups.length; i++) {
    const group = duplicateGroups[i];
    
    console.log(`\n📦 Duplicate Group ${i + 1}/${duplicateGroups.length}`);
    console.log('─'.repeat(60));
    console.log(`Wallet: ${group.wallet_address.slice(0, 10)}...${group.wallet_address.slice(-8)}`);
    console.log(`Amount: ₦${parseFloat(group.ngn_amount).toLocaleString()}`);
    console.log(`User ID: ${group.user_id || 'N/A'}`);
    console.log(`\nTransactions in group: ${group.transactions.length}`);
    
    // Show pending transactions (to be deleted)
    console.log(`\n  ⏳ PENDING (will be deleted):`);
    for (const tx of group.pending) {
      console.log(`     • ${tx.transaction_id} - Created: ${new Date(tx.created_at).toLocaleString()}`);
      deletionList.push(tx.transaction_id);
      totalPendingToDelete++;
    }
    
    // Show completed transactions (to be kept)
    console.log(`\n  ✅ COMPLETED (will be kept):`);
    for (const tx of group.completed) {
      console.log(`     • ${tx.transaction_id} - Completed: ${tx.completed_at ? new Date(tx.completed_at).toLocaleString() : 'N/A'}`);
      console.log(`       TX Hash: ${tx.tx_hash || 'N/A'}`);
    }
  }

  // Summary
  console.log('\n\n📊 CLEANUP SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Total duplicate groups found: ${duplicateGroups.length}`);
  console.log(`Pending transactions to delete: ${totalPendingToDelete}`);
  console.log(`Completed transactions to keep: ${duplicateGroups.reduce((sum, g) => sum + g.completed.length, 0)}`);

  // Execute deletion if not dry run
  if (!dryRun) {
    console.log('\n⚠️  EXECUTING DELETIONS...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const transactionId of deletionList) {
      try {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('transaction_id', transactionId);

        if (error) {
          console.error(`❌ Failed to delete ${transactionId}:`, error.message);
          errorCount++;
        } else {
          console.log(`✅ Deleted: ${transactionId}`);
          successCount++;
        }
      } catch (err: any) {
        console.error(`❌ Error deleting ${transactionId}:`, err.message);
        errorCount++;
      }
    }

    console.log('\n\n🎉 CLEANUP COMPLETE!');
    console.log('═'.repeat(60));
    console.log(`✅ Successfully deleted: ${successCount} transactions`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`\nYour dashboard stats should now be accurate! 🎯`);
  } else {
    console.log('\n\n💡 DRY RUN COMPLETE - No changes made');
    console.log('═'.repeat(60));
    console.log('To execute the cleanup for real, run:');
    console.log('  npm run cleanup-transactions -- --execute\n');
  }
}

// Main execution
const args = process.argv.slice(2);
const isExecute = args.includes('--execute');

cleanupDuplicates(!isExecute)
  .then(() => {
    console.log('\n✨ Script finished successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

