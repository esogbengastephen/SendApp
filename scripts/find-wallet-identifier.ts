/**
 * Find the user identifier used to generate a specific wallet address
 * Usage: npx tsx scripts/find-wallet-identifier.ts <walletAddress>
 */

import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
const envPath = join(process.cwd(), ".env.local");
let envContent = "";
try {
  envContent = readFileSync(envPath, "utf-8");
  const lines = envContent.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
        process.env[key.trim()] = value;
      }
    }
  }
} catch (error) {
  console.error("Could not read .env.local");
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase credentials in .env.local");
  console.error("   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const walletAddress = process.argv[2]?.toLowerCase();

if (!walletAddress) {
  console.error("Usage: npx tsx scripts/find-wallet-identifier.ts <walletAddress>");
  process.exit(1);
}

async function findWalletIdentifier() {
  console.log("🔍 Finding user identifier for wallet:", walletAddress);
  console.log("");

  // Query database for transactions with this wallet
  const { data: transactions, error } = await supabase
    .from("offramp_transactions")
    .select("*")
    .eq("unique_wallet_address", walletAddress)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Database error:", error.message);
    process.exit(1);
  }

  if (!transactions || transactions.length === 0) {
    console.log("❌ No transactions found for this wallet address");
    console.log("");
    console.log("This wallet may have been:");
    console.log("  1. Created manually (not by the system)");
    console.log("  2. Created with a different mnemonic");
    console.log("  3. Not recorded in the database");
    process.exit(0);
  }

  console.log(`✅ Found ${transactions.length} transaction(s) for this wallet\n`);

  // Show all transactions
  transactions.forEach((tx, index) => {
    console.log(`Transaction ${index + 1}:`);
    console.log("  Transaction ID:", tx.transaction_id);
    console.log("  User ID:", tx.user_id || "NULL");
    console.log("  User Email:", tx.user_email || "N/A");
    console.log("  Account Number:", tx.user_account_number || "N/A");
    console.log("  Status:", tx.status);
    console.log("  Created At:", tx.created_at);
    console.log("");

    // Determine the user identifier that was used
    let userIdentifier: string | null = null;
    if (tx.user_id) {
      userIdentifier = tx.user_id;
      console.log("  → User Identifier: user_id (UUID)");
    } else if (tx.user_email && tx.user_email !== "guest") {
      userIdentifier = tx.user_email;
      console.log("  → User Identifier: user_email");
    } else if (tx.user_account_number) {
      userIdentifier = `guest_${tx.user_account_number}`;
      console.log("  → User Identifier: guest_account_number");
    }

    if (userIdentifier) {
      console.log("  → Identifier Value:", userIdentifier);
      console.log("");
      console.log("  💡 Test this identifier with:");
      console.log(`     npx tsx scripts/test-wallet-generation.ts`);
      console.log(`     (Update the script with: ${userIdentifier})`);
    }
    console.log("─".repeat(70));
    console.log("");
  });

  // Show summary
  const uniqueIdentifiers = new Set<string>();
  transactions.forEach((tx) => {
    if (tx.user_id) {
      uniqueIdentifiers.add(`user_id:${tx.user_id}`);
    } else if (tx.user_email && tx.user_email !== "guest") {
      uniqueIdentifiers.add(`user_email:${tx.user_email}`);
    } else if (tx.user_account_number) {
      uniqueIdentifiers.add(`guest_${tx.user_account_number}`);
    }
  });

  console.log("📊 Summary:");
  console.log(`   Total Transactions: ${transactions.length}`);
  console.log(`   Unique Identifiers: ${uniqueIdentifiers.size}`);
  if (uniqueIdentifiers.size > 0) {
    console.log("");
    console.log("   Identifiers found:");
    Array.from(uniqueIdentifiers).forEach((id) => {
      console.log(`     - ${id}`);
    });
  }
}

findWalletIdentifier();

