/**
 * Execute Migration 017 via Supabase API
 * Attempts to execute SQL using various methods
 */

import { readFileSync } from "fs";
import { join } from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ksdzzqdafodlstfkqzuv.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function executeMigration() {
  console.log("🚀 Executing Migration 017 via Supabase API...\n");

  if (!supabaseServiceKey) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY not found in environment");
    console.log("💡 Please set it in .env.local\n");
    return;
  }

  try {
    // Read migration SQL
    const migrationPath = join(process.cwd(), "MIGRATION_017_READY_TO_RUN.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("📄 Migration SQL loaded\n");

    // Method 1: Try Supabase Management API (requires Management API key, not service role)
    // This typically requires a different API key
    
    // Method 2: Try executing via REST API with service role
    // Note: Supabase doesn't support arbitrary SQL via REST API for security
    
    // Method 3: Split into individual operations and execute via Supabase client
    // This is the most reliable approach
    
    console.log("📝 Attempting to execute migration...\n");

    // Since Supabase JS client doesn't support raw SQL, we'll need to:
    // 1. Verify connection
    // 2. Provide the SQL for manual execution OR
    // 3. Use Supabase Dashboard SQL Editor
    
    // Verify connection first
    const testResponse = await fetch(`${supabaseUrl}/rest/v1/users?select=id&limit=1`, {
      headers: {
        "apikey": supabaseServiceKey,
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
    });

    if (!testResponse.ok) {
      console.error("❌ Database connection failed");
      console.log("Response status:", testResponse.status);
      const errorText = await testResponse.text();
      console.log("Error:", errorText.substring(0, 200));
      return;
    }

    console.log("✅ Database connection verified\n");

    // Try to execute via a custom RPC function (if it exists)
    // Or use the Supabase Management API endpoint
    try {
      // Attempt to use Management API endpoint
      const projectRef = supabaseUrl.split("//")[1].split(".")[0];
      const managementUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
      
      const response = await fetch(managementUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ query: migrationSQL }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Migration executed successfully!");
        console.log("Result:", result);
        return;
      } else {
        console.log("⚠️  Management API method not available");
        const errorText = await response.text();
        console.log("Response:", errorText.substring(0, 200));
      }
    } catch (error: any) {
      console.log("⚠️  Management API execution failed:", error.message);
    }

    // Fallback: Provide instructions
    console.log("\n📋 Since direct SQL execution via API is not available,");
    console.log("   please execute the migration via Supabase Dashboard:\n");
    console.log("   1. Open: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new");
    console.log("   2. Copy the SQL below");
    console.log("   3. Paste and click 'Run'\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(migrationSQL);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

executeMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });

