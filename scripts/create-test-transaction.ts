/**
 * Create a test transaction for a specific wallet address
 * This allows testing with external wallets
 */

// 1) Load .env.local first so Supabase keys are available,
//    same pattern as other scripts (get-all-offramp-wallets.ts)
import { readFileSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
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
  console.error("⚠️  Could not read .env.local file.");
}

// 2) Now import Supabase client and helpers
import { supabaseAdmin } from "../lib/supabase";
import { nanoid } from "nanoid";

// TEST CONFIG: update these values when creating a new manual test
// This wallet has already been funded by the user (10 SEND on Base)
const walletAddress = "0x15dA8947C2bCd22f4728d4898ed161F296b0D54B";
// Logged-in user email (shown in the top-right of the app)
const userEmail = "lightblockofweb3@gmail.com";
// Bank details from the user's screenshot (OPay)
const userAccountNumber = "7034494055";
const userAccountName = "GBENGA KOLADE ESO";
// We can leave bank code generic for now; Paystack recipient creation
// will fall back or fail gracefully if this doesn't match exactly.
const userBankCode: string | null = null;

async function createTransaction() {
  console.log(`\n📝 Creating Test Transaction`);
  console.log(`============================\n`);
  console.log(`Wallet: ${walletAddress}\n`);

  try {
    const transactionId = `offramp_test_${nanoid(8)}`;
    
    const { data, error } = await supabaseAdmin
      .from("offramp_transactions")
      .insert({
        transaction_id: transactionId,
        user_id: null,
        user_email: userEmail.toLowerCase(),
        user_account_number: userAccountNumber,
        user_account_name: userAccountName,
        user_bank_code: userBankCode,
        unique_wallet_address: walletAddress.toLowerCase(),
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error(`❌ Error creating transaction: ${error.message}\n`);
      if (error.message?.includes("unique constraint")) {
        console.log(`⚠️  Transaction already exists for this wallet\n`);
        // Try to find existing transaction
        const { data: existing } = await supabaseAdmin
          .from("offramp_transactions")
          .select("*")
          .eq("unique_wallet_address", walletAddress.toLowerCase())
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        
        if (existing) {
          console.log(`✅ Found existing transaction:`);
          console.log(`   ID: ${existing.transaction_id}`);
          console.log(`   Status: ${existing.status}\n`);
        }
      }
      return;
    }

    console.log(`✅ Transaction created successfully!`);
    console.log(`   Transaction ID: ${data.transaction_id}`);
    console.log(`   Wallet: ${data.unique_wallet_address}`);
    console.log(`   Status: ${data.status}\n`);
    console.log(`💡 Next step: Test swap with this transaction ID\n`);
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}\n`);
  }
}

createTransaction();

