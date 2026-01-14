/**
 * Apply Migration 017 using Supabase Management API
 * This script executes the migration directly via HTTP requests
 */

import { readFileSync } from "fs";
import { join } from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ksdzzqdafodlstfkqzuv.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function applyMigration017() {
  console.log("🚀 Applying Migration 017: Add profile fields and wallet management\n");

  if (!supabaseServiceKey) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY is not set in environment variables");
    console.log("💡 Please set it in your .env.local file");
    process.exit(1);
  }

  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), "supabase/migrations/017_add_profile_and_wallet_fields.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("📄 Migration SQL loaded");
    console.log("📝 Executing migration via Supabase Management API...\n");

    // Use Supabase Management API to execute SQL
    // The Management API endpoint for executing SQL
    const projectRef = supabaseUrl.split("//")[1].split(".")[0]; // Extract project ref
    
    // Try using the Supabase Management API
    // Note: This requires the Management API key, not the service role key
    // For now, we'll use a direct approach via the REST API with service role
    
    // Alternative: Execute via Supabase's SQL execution endpoint
    // This might require creating a function or using psql
    
    // Since direct SQL execution isn't available via REST API,
    // we'll use the Supabase client's ability to execute via RPC if available
    // or provide clear instructions
    
    console.log("⚠️  Direct SQL execution via API requires Management API access.");
    console.log("📋 Using alternative method: Execute via Supabase Dashboard\n");
    
    // For now, let's try to verify the connection and provide the SQL
    console.log("✅ Migration SQL prepared");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(migrationSQL);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Try to execute via HTTP request to Supabase's SQL endpoint
    // This is a workaround - Supabase doesn't officially support this
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseServiceKey,
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ sql: migrationSQL }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Migration executed successfully!");
        console.log("Result:", result);
        return;
      } else {
        const errorText = await response.text();
        console.log("⚠️  RPC method not available");
        console.log("Response:", errorText.substring(0, 200));
      }
    } catch (error: any) {
      console.log("⚠️  Direct API execution not available");
      console.log("Error:", error.message);
    }

    // Fallback: Provide instructions
    console.log("\n📝 To apply this migration:");
    console.log("   1. Go to: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new");
    console.log("   2. Copy the SQL above");
    console.log("   3. Paste into SQL Editor");
    console.log("   4. Click 'Run' to execute\n");

    // Verify connection
    const testResponse = await fetch(`${supabaseUrl}/rest/v1/users?select=id&limit=1`, {
      headers: {
        "apikey": supabaseServiceKey,
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
    });

    if (testResponse.ok) {
      console.log("✅ Database connection verified");
      console.log("✅ Service role key is valid\n");
    } else {
      console.error("❌ Database connection failed");
      console.error("Please check your SUPABASE_SERVICE_ROLE_KEY");
    }

  } catch (error: any) {
    console.error("❌ Migration failed:", error);
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

