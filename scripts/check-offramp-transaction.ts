/**
 * Check off-ramp transaction details
 */

import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTransaction() {
  const { data, error } = await supabase
    .from("offramp_transactions")
    .select("*")
    .eq("transaction_id", "offramp_NpVxYXVB0l6s")
    .single();

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("📋 Transaction Details:\n");
  console.log("Transaction ID:", data.transaction_id);
  console.log("Unique Wallet:", data.unique_wallet_address);
  console.log("User Email:", data.user_email);
  console.log("Account Number:", data.user_account_number);
  console.log("Bank Code:", data.user_bank_code);
  console.log("\n🔐 Wallet Generation Test:\n");

  // Test wallet generation with the actual user email
  const userIdentifier = data.user_email;
  const mnemonic = process.env.OFFRAMP_MASTER_MNEMONIC!;

  const mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic);
  const seed = mnemonicObj.computeSeed();
  const rootNode = ethers.HDNodeWallet.fromSeed(seed);

  const hash = userIdentifier
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const derivationIndex = Math.abs(hash) % 2147483647;
  const derivationPath = `m/44'/60'/0'/0/${derivationIndex}`;

  const wallet = rootNode.derivePath(derivationPath);

  console.log("User Identifier:", userIdentifier);
  console.log("Expected Wallet:", data.unique_wallet_address);
  console.log("Generated Wallet:", wallet.address);
  console.log("Derivation Path:", derivationPath);
  console.log(
    "Match:",
    wallet.address.toLowerCase() === data.unique_wallet_address.toLowerCase()
      ? "✅"
      : "❌"
  );
}

checkTransaction();
