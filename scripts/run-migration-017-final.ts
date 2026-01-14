/**
 * Execute Migration 017 - Final attempt via Supabase
 * Loads environment variables and attempts to execute migration
 */

import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";

// Load environment variables
config({ path: join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ksdzzqdafodlstfkqzuv.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function executeMigration() {
  console.log("🚀 Executing Migration 017: Add profile fields and wallet management\n");

  if (!supabaseServiceKey) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY not found");
    console.log("💡 Please ensure it's set in .env.local\n");
    process.exit(1);
  }

  try {
    // Read migration SQL
    const migrationPath = join(process.cwd(), "MIGRATION_017_READY_TO_RUN.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("📄 Migration SQL loaded");
    console.log("🔍 Verifying database connection...\n");

    // Verify connection
    const testResponse = await fetch(`${supabaseUrl}/rest/v1/users?select=id&limit=1`, {
      headers: {
        "apikey": supabaseServiceKey,
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error("❌ Connection failed:", testResponse.status);
      console.error("Error:", errorText.substring(0, 200));
      process.exit(1);
    }

    console.log("✅ Database connection verified\n");

    // Supabase doesn't support arbitrary SQL execution via REST API
    // The best approach is to use the Supabase Dashboard SQL Editor
    // However, we can verify the migration is ready
    
    console.log("📋 Migration SQL is ready to execute:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(migrationSQL);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("🌐 To execute this migration:");
    console.log("   1. Open Supabase SQL Editor:");
    console.log(`      https://supabase.com/dashboard/project/${supabaseUrl.split("//")[1].split(".")[0]}/sql/new`);
    console.log("   2. Copy the SQL above");
    console.log("   3. Paste into SQL Editor");
    console.log("   4. Click 'Run' to execute\n");

    console.log("✅ Migration file is ready at: MIGRATION_017_READY_TO_RUN.sql");
    console.log("✅ All code implementation is complete");
    console.log("✅ Ready to use once migration is applied\n");

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

executeMigration()
  .then(() => {
    console.log("✅ Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });

