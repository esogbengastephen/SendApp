/**
 * Check why smart wallet 0x97F92d40b1201220E4BECf129c16661e457f6147
 * might not be linked to user esogbengastephen@gmail.com
 *
 * Run: npx tsx scripts/check-smart-wallet-link.ts
 */

import * as dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const WALLET = "0x97F92d40b1201220E4BECf129c16661e457f6147";
const WALLET_LOWER = WALLET.toLowerCase();
const EMAIL = "esogbengastephen@gmail.com";

async function main() {
  const { supabaseAdmin } = await import("../lib/supabase");

  console.log("=== Smart wallet link check ===\n");
  console.log("Wallet:", WALLET);
  console.log("Email:", EMAIL);
  console.log("");

  // 1) User by email
  const { data: userByEmail, error: e1 } = await supabaseAdmin
    .from("users")
    .select("id, email, smart_wallet_address, smart_wallet_owner_encrypted")
    .eq("email", EMAIL)
    .maybeSingle();

  if (e1) {
    console.error("Error fetching user by email:", e1.message);
    return;
  }
  if (!userByEmail) {
    console.log("1) User by email: NOT FOUND");
    console.log("   No user with email:", EMAIL);
  } else {
    console.log("1) User by email: FOUND");
    console.log("   id:", userByEmail.id);
    console.log("   email:", userByEmail.email);
    console.log("   smart_wallet_address:", userByEmail.smart_wallet_address ?? "(null)");
    console.log("   has smart_wallet_owner_encrypted:", !!userByEmail.smart_wallet_owner_encrypted);
    if (userByEmail.smart_wallet_address) {
      const match = userByEmail.smart_wallet_address.toLowerCase() === WALLET_LOWER;
      console.log("   matches target wallet:", match);
    }
  }

  // 2) User(s) with this smart_wallet_address (exact match)
  const { data: userByWalletExact, error: e2 } = await supabaseAdmin
    .from("users")
    .select("id, email, smart_wallet_address")
    .eq("smart_wallet_address", WALLET)
    .maybeSingle();

  if (e2) console.error("Error (exact wallet):", e2.message);
  console.log("\n2) User with smart_wallet_address = (exact):", userByWalletExact ? userByWalletExact.email : "NONE");

  // 3) User(s) with wallet lowercase
  const { data: userByWalletLower, error: e3 } = await supabaseAdmin
    .from("users")
    .select("id, email, smart_wallet_address")
    .eq("smart_wallet_address", WALLET_LOWER)
    .maybeSingle();

  if (e3) console.error("Error (lowercase wallet):", e3.message);
  console.log("3) User with smart_wallet_address = (lowercase):", userByWalletLower ? userByWalletLower.email : "NONE");

  // 4) Off-ramp rows with this deposit_address
  const { data: offramps, error: e4 } = await supabaseAdmin
    .from("offramp_transactions")
    .select("transaction_id, user_id, deposit_address, wallet_address, account_name, status, created_at")
    .or(`deposit_address.eq.${WALLET},deposit_address.eq.${WALLET_LOWER},wallet_address.eq.${WALLET},wallet_address.eq.${WALLET_LOWER}`)
    .order("created_at", { ascending: false })
    .limit(5);

  if (e4) {
    console.error("Error (offramp):", e4.message);
  } else {
    console.log("\n4) Off-ramp rows with this wallet:", offramps?.length ?? 0);
    offramps?.forEach((r, i) => {
      console.log(`   [${i + 1}] tx: ${r.transaction_id}, user_id: ${r.user_id}, account_name: ${r.account_name}, status: ${r.status}`);
    });
  }

  // 5) Off-ramp for user by email (if we found them)
  if (userByEmail?.id) {
    const { data: userOfframps } = await supabaseAdmin
      .from("offramp_transactions")
      .select("transaction_id, deposit_address, status, created_at")
      .eq("user_id", userByEmail.id)
      .order("created_at", { ascending: false })
      .limit(3);
    console.log("\n5) Off-ramp rows for user", EMAIL, ":", userOfframps?.length ?? 0);
    userOfframps?.forEach((r, i) => {
      const addrMatch = r.deposit_address?.toLowerCase() === WALLET_LOWER;
      console.log(`   [${i + 1}] deposit_address: ${r.deposit_address}, matches wallet: ${addrMatch}, status: ${r.status}`);
    });
  }

  console.log("\n=== Summary ===");
  if (userByEmail && !userByEmail.smart_wallet_address) {
    console.log("ISSUE: User exists but smart_wallet_address is NULL. The verify-and-create update may have failed.");
    if (offramps?.length) {
      console.log("FIX: Update users set smart_wallet_address = '" + WALLET + "', smart_wallet_owner_encrypted = <encrypted_key> where id = '" + userByEmail.id + "'");
      console.log("     (You need the owner key encrypted for this user; or re-run off-ramp flow to recreate wallet and save it.)");
    }
  } else if (userByEmail && userByEmail.smart_wallet_address?.toLowerCase() !== WALLET_LOWER) {
    console.log("ISSUE: User has a different smart_wallet_address than the one shown in the UI.");
  } else if (!userByEmail) {
    console.log("ISSUE: No user with email", EMAIL, "- ensure they signed up / exist in auth and users table.");
  } else {
    console.log("User and wallet are linked. If sweep still fails, check smart_wallet_owner_encrypted and RLS.");
  }
}

main();
