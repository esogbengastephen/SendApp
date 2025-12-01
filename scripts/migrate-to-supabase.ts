/**
 * Migration script to move existing in-memory data to Supabase
 * Run with: npx tsx scripts/migrate-to-supabase.ts
 */

import { supabase } from "../lib/supabase";

async function migrateData() {
  console.log("🚀 Starting data migration to Supabase...\n");

  try {
    // Check connection
    console.log("1️⃣ Checking Supabase connection...");
    const { data: testData, error: testError } = await supabase
      .from("users")
      .select("count")
      .limit(1);

    if (testError) {
      console.error("❌ Failed to connect to Supabase:", testError.message);
      return;
    }
    console.log("✅ Connected to Supabase successfully\n");

    // Note: In-memory data exists only during runtime
    // This script serves as a template for migrating data if you have it stored elsewhere
    // (e.g., JSON files, CSV files, or another database)

    console.log("2️⃣ Checking current data in Supabase...");
    
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email");

    if (usersError) {
      console.error("❌ Error fetching users:", usersError.message);
      return;
    }

    console.log(`   Found ${users?.length || 0} users in Supabase`);

    const { data: wallets, error: walletsError } = await supabase
      .from("user_wallets")
      .select("id, wallet_address, user_id");

    if (walletsError) {
      console.error("❌ Error fetching wallets:", walletsError.message);
      return;
    }

    console.log(`   Found ${wallets?.length || 0} wallet records in Supabase`);

    const { data: transactions, error: transactionsError } = await supabase
      .from("transactions")
      .select("transaction_id, status");

    if (transactionsError) {
      console.error("❌ Error fetching transactions:", transactionsError.message);
      return;
    }

    console.log(`   Found ${transactions?.length || 0} transactions in Supabase\n`);

    console.log("✅ Migration script completed!");
    console.log("\n📝 Next steps:");
    console.log("   1. Run the Supabase migration: 006_restructure_for_multi_wallet.sql");
    console.log("   2. Restart your dev server");
    console.log("   3. New transactions will automatically be stored in Supabase");
    console.log("   4. Users with email login will have their wallets tracked");
    console.log("\n💡 Note: In-memory data is temporary and cleared on server restart.");
    console.log("   Going forward, all data will be persisted in Supabase.");

  } catch (error: any) {
    console.error("❌ Migration error:", error.message);
    throw error;
  }
}

// Run migration
migrateData()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });

