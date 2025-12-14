/**
 * Create a test transaction for a specific wallet address
 * This allows testing with external wallets
 */

import { supabaseAdmin } from "../lib/supabase";
import { nanoid } from "nanoid";

const walletAddress = "0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2";

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
        user_email: "test@example.com",
        user_account_number: "1234567890",
        user_account_name: "Test User",
        user_bank_code: "058",
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

