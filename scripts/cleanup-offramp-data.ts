/**
 * Clean up all offramp transaction data
 * This script deletes all records from offramp tables to start fresh with new wallet credentials
 * 
 * CAUTION: This will permanently delete:
 * - All offramp transactions
 * - All offramp revenue records
 * - All offramp swap attempts
 * 
 * Settings (fee tiers, exchange rates) will be preserved
 */

import { supabaseAdmin } from "../lib/supabase";

async function cleanupOfframpData() {
  console.log("🧹 Starting offramp data cleanup...\n");

  try {
    // 1. Count existing records before deletion
    const { count: transactionCount } = await supabaseAdmin
      .from("offramp_transactions")
      .select("*", { count: "exact", head: true });

    const { count: revenueCount } = await supabaseAdmin
      .from("offramp_revenue")
      .select("*", { count: "exact", head: true });

    const { count: swapAttemptsCount } = await supabaseAdmin
      .from("offramp_swap_attempts")
      .select("*", { count: "exact", head: true });

    console.log("📊 Current record counts:");
    console.log(`   - Offramp transactions: ${transactionCount || 0}`);
    console.log(`   - Offramp revenue: ${revenueCount || 0}`);
    console.log(`   - Offramp swap attempts: ${swapAttemptsCount || 0}\n`);

    if ((transactionCount || 0) === 0) {
      console.log("✅ No offramp data found. Database is already clean!\n");
      return;
    }

    // 2. Delete all offramp_transactions
    // This will CASCADE delete offramp_revenue and offramp_swap_attempts automatically
    console.log("🗑️  Deleting all offramp transactions...");
    const { error: deleteError, count: deletedCount } = await supabaseAdmin
      .from("offramp_transactions")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000") // Delete all records
      .select("id", { count: "exact", head: true });

    if (deleteError) {
      console.error("❌ Error deleting offramp transactions:", deleteError);
      throw deleteError;
    }

    console.log(`✅ Deleted ${deletedCount || transactionCount} offramp transactions\n`);

    // 3. Verify cleanup
    console.log("🔍 Verifying cleanup...");
    const { count: remainingTransactions } = await supabaseAdmin
      .from("offramp_transactions")
      .select("*", { count: "exact", head: true });

    const { count: remainingRevenue } = await supabaseAdmin
      .from("offramp_revenue")
      .select("*", { count: "exact", head: true });

    const { count: remainingSwapAttempts } = await supabaseAdmin
      .from("offramp_swap_attempts")
      .select("*", { count: "exact", head: true });

    console.log("\n📊 After cleanup:");
    console.log(`   - Offramp transactions: ${remainingTransactions || 0}`);
    console.log(`   - Offramp revenue: ${remainingRevenue || 0}`);
    console.log(`   - Offramp swap attempts: ${remainingSwapAttempts || 0}\n`);

    if ((remainingTransactions || 0) === 0 && (remainingRevenue || 0) === 0 && (remainingSwapAttempts || 0) === 0) {
      console.log("✅ SUCCESS! All offramp transaction data has been deleted.\n");
      console.log("📝 Note: Offramp settings (fee tiers, exchange rates) were preserved.");
      console.log("🔑 Your new wallet credentials are now active and ready to use.\n");
    } else {
      console.log("⚠️  Warning: Some records may still remain. Please check manually.\n");
    }

  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    throw error;
  }
}

// Run cleanup
cleanupOfframpData()
  .then(() => {
    console.log("✅ Cleanup complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  });
