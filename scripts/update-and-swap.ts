/**
 * Update transaction to use SEND as primary token and trigger swap
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Supabase environment variables are not set.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const transactionId = "offramp_Y81PZ3oLNTjY";
const SEND_TOKEN_ADDRESS = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLETS?.split(",")[0] || "";

async function updateAndSwap() {
  console.log(`\n🔄 Updating transaction ${transactionId} to use SEND as primary token...\n`);

  // Update transaction
  const { error: updateError } = await supabase
    .from("offramp_transactions")
    .update({
      token_address: SEND_TOKEN_ADDRESS,
      token_symbol: "SEND",
      token_amount: "100",
      token_amount_raw: "100000000000000000000",
      status: "token_received",
      updated_at: new Date().toISOString(),
    })
    .eq("transaction_id", transactionId);

  if (updateError) {
    console.error("❌ Error updating transaction:", updateError.message);
    process.exit(1);
  }

  console.log("✅ Transaction updated successfully\n");

  // Trigger swap
  console.log("🔄 Triggering swap...\n");

  try {
    const response = await fetch("http://localhost:3000/api/offramp/swap-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId }),
    });

    const data = await response.json();

    if (data.success) {
      console.log("✅ Swap triggered successfully!\n");
      console.log(`   Transaction ID: ${data.transactionId}`);
      console.log(`   Swap TX Hash: ${data.swapTxHash || "Processing..."}`);
      console.log(`   USDC Amount: ${data.usdcAmount || "Calculating..."}`);
      console.log(`   Wallet: ${data.walletAddress}\n`);
    } else {
      console.error("❌ Swap failed:", data.error || data.message);
      if (data.hint) {
        console.error(`   Hint: ${data.hint}`);
      }
    }
  } catch (error: any) {
    console.error("❌ Error triggering swap:", error.message);
  }
}

updateAndSwap();

