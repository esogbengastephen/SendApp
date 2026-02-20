/**
 * Fix users and offramp_transactions where smart_wallet_address or deposit_address
 * was stored as "WalletAddress{ addressId: '0x...', ... }" instead of plain 0x...
 *
 * Run: npx tsx scripts/fix-wallet-address-strings.ts
 */

import * as dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { normalizeSmartWalletAddress } from "../lib/coinbase-smart-wallet";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

async function main() {
  const { supabaseAdmin } = await import("../lib/supabase");

  console.log("=== Fix WalletAddress object strings in DB ===\n");

  // 1) Users with smart_wallet_address containing "WalletAddress" or not a plain 0x
  const { data: users, error: e1 } = await supabaseAdmin
    .from("users")
    .select("id, email, smart_wallet_address")
    .not("smart_wallet_address", "is", null);

  if (e1) {
    console.error("Error fetching users:", e1.message);
    process.exit(1);
  }

  let usersFixed = 0;
  for (const u of users ?? []) {
    const addr = u.smart_wallet_address as string;
    if (!addr || addr.length === 42 && addr.startsWith("0x")) continue;
    const normalized = normalizeSmartWalletAddress(addr);
    if (!normalized || normalized === addr) continue;
    const { error: up } = await supabaseAdmin
      .from("users")
      .update({ smart_wallet_address: normalized })
      .eq("id", u.id);
    if (up) {
      console.error("Failed to update user", u.email, up.message);
    } else {
      console.log("Updated user", u.email, "->", normalized);
      usersFixed++;
    }
  }
  console.log("Users updated:", usersFixed, "\n");

  // 2) offramp_transactions: deposit_address, wallet_address, wallet_identifier, unique_wallet_address
  const cols = ["deposit_address", "wallet_address", "wallet_identifier", "unique_wallet_address", "smart_wallet_address"];
  const { data: rows, error: e2 } = await supabaseAdmin
    .from("offramp_transactions")
    .select("id, transaction_id, deposit_address, wallet_address, wallet_identifier, unique_wallet_address, smart_wallet_address");

  if (e2) {
    console.error("Error fetching offramp_transactions:", e2.message);
    process.exit(1);
  }

  let offrampsFixed = 0;
  for (const r of rows ?? []) {
    const updates: Record<string, string> = {};
    for (const col of cols) {
      const val = (r as any)[col];
      if (val == null) continue;
      const normalized = normalizeSmartWalletAddress(val);
      if (normalized && normalized !== val) updates[col] = normalized;
    }
    if (Object.keys(updates).length === 0) continue;
    const { error: up } = await supabaseAdmin
      .from("offramp_transactions")
      .update(updates)
      .eq("id", r.id);
    if (up) {
      console.error("Failed to update offramp", r.transaction_id, up.message);
    } else {
      console.log("Updated offramp", r.transaction_id, updates);
      offrampsFixed++;
    }
  }
  console.log("Off-ramp rows updated:", offrampsFixed);
  console.log("\nDone.");
}

main();
