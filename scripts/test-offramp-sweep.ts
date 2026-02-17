/**
 * Test off-ramp: check SEND balance at a Smart Wallet, sweep to OFFRAMP_RECEIVER_WALLET_ADDRESS,
 * then send NGN via Flutterwave to a given account (e.g. 7034494055 OPay).
 *
 * Prerequisites:
 * - .env.local: OFFRAMP_RECEIVER_WALLET_ADDRESS, COINBASE_BUNDLER_RPC_URL, Flutterwave keys
 * - The wallet address must belong to a user in DB (smart_wallet_address) so we have the owner key for sweep
 *
 * Usage:
 *   npx tsx scripts/test-offramp-sweep.ts                    # default wallet, 7034494055 OPay
 *   npx tsx scripts/test-offramp-sweep.ts --balance-only    # only check SEND balance, no sweep
 *   npx tsx scripts/test-offramp-sweep.ts 0x97F9... 7034494055 100022
 */

import * as dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

import type { OfframpRow } from "../lib/offramp-sweep-payout";

const args = process.argv.slice(2);
const balanceOnly = args.includes("--balance-only");
const posArgs = args.filter((a) => a !== "--balance-only");
const WALLET = posArgs[0]?.trim() || "0x97F92d40b1201220E4BECf129c16661e457f6147";
const ACCOUNT_NUMBER = posArgs[1]?.replace(/\D/g, "").slice(0, 10) || "7034494055";
const BANK_CODE = posArgs[2]?.trim() || "100022"; // OPay

async function main() {
  const { getTokenBalance } = await import("../lib/blockchain");
  const offramp = await import("../lib/offramp-sweep-payout");
  const { verifyBankAccount } = await import("../lib/flutterwave");
  const { supabaseAdmin } = await import("../lib/supabase");
  const { nanoid } = await import("nanoid");
  const { getOfframpPoolAddress, getSendToNgnSellRate, processOneOfframpPayout } = offramp;

  const depositAddress = WALLET.startsWith("0x") ? WALLET : `0x${WALLET}`;
  const normalized = depositAddress.toLowerCase();

  console.log("Off-ramp sweep test\n");
  console.log("Deposit wallet:", depositAddress);
  console.log("Receiver (pool):", getOfframpPoolAddress());
  console.log("Payout account:", ACCOUNT_NUMBER, "Bank code:", BANK_CODE, "(OPay)\n");

  // 1) SEND balance at wallet
  let sendBalance: string;
  try {
    sendBalance = await getTokenBalance(depositAddress);
    console.log("SEND balance at wallet:", sendBalance);
  } catch (e) {
    console.error("Failed to get balance:", e);
    process.exit(1);
  }

  const sendNum = parseFloat(sendBalance);
  if (balanceOnly) {
    const { getOfframpPoolAddress } = await import("../lib/offramp-sweep-payout");
    const { getSendToNgnSellRate } = await import("../lib/offramp-sweep-payout");
    console.log("Receiver (OFFRAMP_RECEIVER_WALLET_ADDRESS or pool):", getOfframpPoolAddress());
    const rate = await getSendToNgnSellRate();
    const ngnAmount = Math.floor(sendNum * rate);
    console.log("Sell rate: 1 SEND =", rate, "NGN → would pay ~₦" + ngnAmount);
    return;
  }
  if (isNaN(sendNum) || sendNum < 0.01) {
    console.error("Insufficient SEND balance (min 0.01). Current:", sendBalance);
    process.exit(1);
  }

  // 2) Find user that owns this Smart Wallet
  const { data: userRow, error: userErr } = await supabaseAdmin
    .from("users")
    .select("id, email, smart_wallet_address, smart_wallet_owner_encrypted")
    .in("smart_wallet_address", [depositAddress, normalized])
    .limit(1)
    .maybeSingle();

  if (userErr || !userRow?.id) {
    console.error("No user found with smart_wallet_address =", depositAddress);
    process.exit(1);
  }
  console.log("Found user:", userRow.email, "id:", userRow.id);

  // 3) Verify bank account (Flutterwave)
  const verifyResult = await verifyBankAccount(ACCOUNT_NUMBER, BANK_CODE);
  if (!verifyResult.success || !verifyResult.data?.accountName) {
    console.error("Flutterwave account verification failed:", verifyResult.error);
    process.exit(1);
  }
  const accountName = verifyResult.data.accountName;
  console.log("Verified account name:", accountName);

  // 4) Sell rate and NGN amount
  const rate = await getSendToNgnSellRate();
  const ngnAmount = Math.floor(sendNum * rate);
  console.log("Sell rate: 1 SEND =", rate, "NGN → NGN amount:", ngnAmount);

  // 5) Create pending off-ramp row
  const transactionId = nanoid();
  const insertPayload = {
    transaction_id: transactionId,
    user_id: userRow.id,
    user_email: userRow.email ?? null,
    wallet_address: depositAddress,
    deposit_address: depositAddress,
    deposit_private_key_encrypted: null,
    smart_wallet_address: depositAddress,
    solana_wallet_address: null,
    wallet_identifier: depositAddress,
    unique_wallet_address: depositAddress,
    account_number: ACCOUNT_NUMBER,
    account_name: accountName,
    bank_code: BANK_CODE,
    bank_name: "OPay",
    user_account_number: ACCOUNT_NUMBER,
    user_account_name: accountName,
    user_bank_code: BANK_CODE,
    network: "base",
    status: "pending",
  };

  const { error: insertError } = await supabaseAdmin.from("offramp_transactions").insert(insertPayload);
  if (insertError) {
    console.error("Failed to insert off-ramp row:", insertError);
    process.exit(1);
  }
  console.log("Created off-ramp row:", transactionId);

  // 6) Fetch row for processOneOfframpPayout
  const { data: row, error: rowErr } = await supabaseAdmin
    .from("offramp_transactions")
    .select("id, transaction_id, user_id, deposit_address, deposit_private_key_encrypted, account_number, account_name, bank_code, network, status")
    .eq("transaction_id", transactionId)
    .single();

  if (rowErr || !row) {
    console.error("Failed to fetch row:", rowErr);
    process.exit(1);
  }

  // 7) Sweep + Flutterwave payout
  console.log("\nRunning sweep + Flutterwave payout...");
  const result = await processOneOfframpPayout(row as OfframpRow);

  if (result.success) {
    console.log("\nSuccess:");
    console.log("  SEND swept:", result.sendAmount);
    console.log("  NGN sent:", result.ngnAmount);
    console.log("  Tx hash:", result.sweepTxHash);
  } else {
    console.error("\nFailed:", result.error);
    process.exit(1);
  }
}

main();
