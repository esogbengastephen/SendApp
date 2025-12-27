/**
 * Fix incorrect wallet address in database for transaction offramp_XHJH04ovkPI3
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixWalletAddress() {
  const transactionId = "offramp_XHJH04ovkPI3";
  const correctWallet = "0x6a2276395B8C617463f3C1574Cb57E82EcbF0522";

  console.log("🔧 Fixing Wallet Address\n");
  console.log(`Transaction ID: ${transactionId}`);
  console.log(`Correct Wallet: ${correctWallet}\n`);

  // Check current state
  const { data: before, error: beforeError } = await supabase
    .from("offramp_transactions")
    .select("unique_wallet_address, status")
    .eq("transaction_id", transactionId)
    .single();

  if (beforeError) {
    console.error("❌ Error fetching transaction:", beforeError);
    return;
  }

  console.log(`Current wallet in DB: ${before.unique_wallet_address}`);
  console.log(`Current status: ${before.status}\n`);

  // Update wallet address
  const { data: updated, error: updateError } = await supabase
    .from("offramp_transactions")
    .update({
      unique_wallet_address: correctWallet,
      updated_at: new Date().toISOString(),
    })
    .eq("transaction_id", transactionId)
    .select();

  if (updateError) {
    console.error("❌ Error updating:", updateError);
    return;
  }

  console.log("✅ Wallet address updated successfully!\n");
  console.log("Updated record:", updated);
}

fixWalletAddress();
