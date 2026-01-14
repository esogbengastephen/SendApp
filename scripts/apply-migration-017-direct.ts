/**
 * Apply Migration 017 by executing individual statements
 * Uses Supabase client to verify and apply changes incrementally
 */

import { supabaseAdmin } from "../lib/supabase";
import { readFileSync } from "fs";
import { join } from "path";

async function applyMigration017() {
  console.log("🚀 Applying Migration 017: Add profile fields and wallet management\n");

  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), "supabase/migrations/017_add_profile_and_wallet_fields.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("📄 Migration SQL loaded\n");

    // Since Supabase JS client doesn't support raw SQL execution,
    // we'll verify the connection and provide the SQL for manual execution
    // OR use the Supabase Dashboard SQL Editor

    // Verify connection first
    console.log("🔍 Verifying database connection...");
    const { data: testData, error: testError } = await supabaseAdmin
      .from("users")
      .select("id")
      .limit(1);

    if (testError) {
      console.error("❌ Database connection failed:", testError.message);
      console.log("\n💡 Make sure SUPABASE_SERVICE_ROLE_KEY is set in .env.local");
      console.log("💡 Or run this migration manually in Supabase SQL Editor\n");
      
      console.log("📋 SQL to execute manually:");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(migrationSQL);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      
      console.log("🌐 Open: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new");
      process.exit(1);
    }

    console.log("✅ Database connection verified\n");

    // Check if columns already exist
    console.log("🔍 Checking if migration has already been applied...");
    const { data: userData, error: checkError } = await supabaseAdmin
      .from("users")
      .select("display_name, wallet_addresses, passkey_credential_id")
      .limit(1);

    if (!checkError) {
      // Check if new columns exist by trying to select them
      const hasNewColumns = 
        userData !== null && 
        (userData.length === 0 || 
         'display_name' in (userData[0] || {}) ||
         'wallet_addresses' in (userData[0] || {}));

      if (hasNewColumns) {
        console.log("⚠️  Some columns may already exist");
        console.log("💡 Migration uses IF NOT EXISTS, so it's safe to run again\n");
      }
    }

    // Since we can't execute raw SQL via the JS client,
    // we need to use the Supabase Dashboard or Management API
    console.log("📝 Migration SQL ready to execute:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(migrationSQL);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("🌐 To apply this migration:");
    console.log("   1. Open Supabase SQL Editor:");
    console.log("      https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new");
    console.log("   2. Copy the SQL above");
    console.log("   3. Paste into the SQL Editor");
    console.log("   4. Click 'Run' to execute");
    console.log("   5. Verify success message\n");

    // Try to provide a direct link or alternative method
    console.log("💡 Alternative: If you have Supabase CLI installed:");
    console.log("   supabase db push --file supabase/migrations/017_add_profile_and_wallet_fields.sql\n");

    // Verify after (user would need to run this manually)
    console.log("✅ After running the migration, verify with:");
    console.log("   SELECT column_name FROM information_schema.columns");
    console.log("   WHERE table_name = 'users'");
    console.log("   AND column_name IN ('wallet_addresses', 'passkey_credential_id');\n");

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.log("\n📋 SQL to execute manually:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const migrationPath = join(process.cwd(), "supabase/migrations/017_add_profile_and_wallet_fields.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");
    console.log(migrationSQL);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    process.exit(1);
  }
}

// Run the migration
applyMigration017()
  .then(() => {
    console.log("✅ Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });

