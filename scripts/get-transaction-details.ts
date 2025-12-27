/**
 * Get transaction details from database
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getTransactionDetails() {
  // Search by payment_address which should match the wallet
  const { data, error } = await supabase
    .from("offramp_transactions")
    .select("*")
    .eq("payment_address", "0x6459AE03e607E9F1A62De6bC17b6977a9F922679")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error("Error:", error);
    console.log("\nTrying by transaction_id...");
    
    const { data: data2, error: error2 } = await supabase
      .from("offramp_transactions")
      .select("*")
      .eq("transaction_id", "offramp_60r306ZKCtk2")
      .single();
    
    if (error2) {
      console.error("Error2:", error2);
      return;
    }
    
    console.log("\nTransaction Details:");
    console.log(JSON.stringify(data2, null, 2));
    return;
  }

  console.log("Transaction Details:");
  console.log(JSON.stringify(data, null, 2));
}

getTransactionDetails();

