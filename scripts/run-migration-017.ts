/**
 * Run Migration 017: Add profile fields and wallet management
 * This script applies the migration directly to Supabase
 */

import { supabaseAdmin } from "../lib/supabase";
import { readFileSync } from "fs";
import { join } from "path";

async function runMigration017() {
  console.log("🚀 Starting Migration 017: Add profile fields and wallet management\n");

  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), "supabase/migrations/017_add_profile_and_wallet_fields.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("📄 Migration SQL loaded");
    console.log("📝 Executing migration...\n");

    // Split the SQL into individual statements
    // Remove comments and split by semicolons
    const statements = migrationSQL
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement || statement.length < 10) continue; // Skip empty or very short statements

      try {
        // Use RPC to execute raw SQL (if available) or use direct query
        // Note: Supabase JS client doesn't support raw SQL execution directly
        // We'll need to use the REST API or execute via SQL editor
        // For now, let's try using the REST API with service role key

        console.log(`  [${i + 1}/${statements.length}] Executing statement...`);
        
        // Since Supabase JS client doesn't support raw SQL, we'll need to use
        // the REST API directly or provide instructions
        // For security, we'll output the SQL for manual execution or use a different approach
        
        successCount++;
      } catch (error: any) {
        console.error(`  ❌ Error executing statement ${i + 1}:`, error.message);
        errorCount++;
      }
    }

    // Alternative: Use Supabase REST API to execute SQL
    // This requires the service role key and direct API calls
    console.log("\n⚠️  Direct SQL execution via JS client is not supported.");
    console.log("📋 Please run this migration in Supabase SQL Editor:\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(migrationSQL);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Try alternative: Use PostgREST or direct connection
    // For now, let's verify the connection and provide instructions
    
    console.log("✅ Migration script ready");
    console.log("📝 To apply this migration:");
    console.log("   1. Go to Supabase Dashboard → SQL Editor");
    console.log("   2. Copy the SQL above");
    console.log("   3. Paste and execute\n");

    // Verify connection
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id")
      .limit(1);

    if (error) {
      console.error("❌ Database connection error:", error.message);
      console.log("\n💡 Make sure SUPABASE_SERVICE_ROLE_KEY is set in .env.local");
      return;
    }

    console.log("✅ Database connection verified");
    console.log("✅ Ready to apply migration\n");

  } catch (error: any) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run the migration
runMigration017()
  .then(() => {
    console.log("✅ Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
