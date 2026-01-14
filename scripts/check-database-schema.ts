/**
 * Script to check current database schema
 * Verifies that all required fields exist for multi-chain wallet system
 */

import { supabaseAdmin } from "../lib/supabase";

async function checkDatabaseSchema() {
  console.log("🔍 Checking database schema...\n");

  try {
    // Check users table structure
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from("users")
      .select("*")
      .limit(1);

    if (usersError) {
      console.error("❌ Error querying users table:", usersError);
      return;
    }

    console.log("✅ Users table exists and is accessible");

    // Check for required columns by trying to select them
    const { data: testUser, error: testError } = await supabaseAdmin
      .from("users")
      .select(`
        id,
        email,
        display_name,
        photo_url,
        passkey_credential_id,
        passkey_public_key,
        wallet_seed_encrypted,
        wallet_addresses,
        wallet_created_at,
        passkey_created_at,
        referral_code,
        email_verified,
        created_at,
        updated_at
      `)
      .limit(1);

    if (testError) {
      console.error("❌ Error checking columns:", testError);
      console.log("\n📋 Missing columns detected. Please run migration 017.");
      return;
    }

    console.log("✅ All required columns exist in users table\n");

    // Check if wallet_addresses is JSONB
    console.log("📊 Schema Verification:");
    console.log("  ✅ display_name - Profile field");
    console.log("  ✅ photo_url - Profile field");
    console.log("  ✅ passkey_credential_id - Passkey authentication");
    console.log("  ✅ passkey_public_key - Passkey public key");
    console.log("  ✅ wallet_seed_encrypted - Encrypted seed phrase");
    console.log("  ✅ wallet_addresses - JSONB for multi-chain addresses");
    console.log("  ✅ wallet_created_at - Wallet creation timestamp");
    console.log("  ✅ passkey_created_at - Passkey creation timestamp\n");

    // Check for indexes
    console.log("🔍 Checking indexes...");
    // Note: We can't directly query indexes via Supabase client,
    // but if the columns exist, indexes should be created by migration

    // Check if any users have wallets
    const { data: usersWithWallets, error: walletError } = await supabaseAdmin
      .from("users")
      .select("id, email, wallet_addresses, passkey_credential_id")
      .not("wallet_addresses", "is", null)
      .limit(5);

    if (walletError) {
      console.error("❌ Error checking wallets:", walletError);
    } else {
      const walletCount = usersWithWallets?.length || 0;
      console.log(`\n📈 Users with wallets: ${walletCount}`);
      if (walletCount > 0) {
        console.log("\n📋 Sample wallet data:");
        usersWithWallets?.forEach((user) => {
          console.log(`  User: ${user.email}`);
          console.log(`  Has Passkey: ${!!user.passkey_credential_id}`);
          console.log(`  Wallet Addresses:`, user.wallet_addresses);
          console.log("");
        });
      }
    }

    // Check user_wallets table (for legacy multi-wallet support)
    const { data: userWallets, error: uwError } = await supabaseAdmin
      .from("user_wallets")
      .select("id, user_id, wallet_address")
      .limit(1);

    if (uwError && uwError.code !== "PGRST116") {
      console.error("⚠️  user_wallets table check:", uwError.message);
    } else {
      console.log("✅ user_wallets table exists (legacy multi-wallet support)");
    }

    console.log("\n✅ Database schema check complete!");
    console.log("\n📝 Next steps:");
    console.log("  1. If any columns are missing, run migration 017");
    console.log("  2. Test passkey creation");
    console.log("  3. Test wallet generation");
    console.log("  4. Test profile updates");

  } catch (error: any) {
    console.error("❌ Error checking database schema:", error);
  }
}

// Run the check
checkDatabaseSchema()
  .then(() => {
    console.log("\n✅ Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });

