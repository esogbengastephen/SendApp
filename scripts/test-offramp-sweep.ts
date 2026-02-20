/**
 * Test off-ramp: check SEND balance at a Smart Wallet, sweep to OFFRAMP_RECEIVER_WALLET_ADDRESS,
 * then send NGN via Flutterwave to a given account.
 *
 * Prerequisites:
 * - .env.local: OFFRAMP_RECEIVER_WALLET_ADDRESS, COINBASE_BUNDLER_RPC_URL, Flutterwave keys
 * - Either: wallet belongs to a user in DB (smart_wallet_address), OR set OFFRAMP_TEST_OWNER_PRIVATE_KEY (hex) for that wallet
 *
 * Usage:
 *   npx tsx scripts/test-offramp-sweep.ts                        # default: wallet 0x97F9..., account 0123456789, GTBank (058)
 *   npx tsx scripts/test-offramp-sweep.ts --balance-only          # only check SEND balance, no sweep
 *   npx tsx scripts/test-offramp-sweep.ts 0x97F9... 0123456789 058   # wallet, account, bank (058 = GTBank)
 *   OFFRAMP_TEST_OWNER_PRIVATE_KEY=<hex> npx tsx scripts/test-offramp-sweep.ts   # use key when wallet not in DB
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
const ACCOUNT_NUMBER = posArgs[1]?.replace(/\D/g, "").slice(0, 10) || "0123456789";
const BANK_CODE = posArgs[2]?.trim() || "058"; // 058 = Guaranty Trust Bank (GTBank)

async function main() {
  const { getTokenBalance } = await import("../lib/blockchain");
  const offramp = await import("../lib/offramp-sweep-payout");
  const { verifyBankAccount } = await import("../lib/bank-verification");
  const { supabaseAdmin } = await import("../lib/supabase");
  const { nanoid } = await import("nanoid");
  const { getOfframpPoolAddress, getSendToNgnSellRate, processOneOfframpPayout } = offramp;

  const depositAddress = WALLET.startsWith("0x") ? WALLET : `0x${WALLET}`;
  const normalized = depositAddress.toLowerCase();

  console.log("Off-ramp sweep test\n");
  console.log("Deposit wallet:", depositAddress);
  console.log("Receiver (pool):", getOfframpPoolAddress());
  const bankLabel = BANK_CODE === "058" ? " (GTBank)" : "";
  console.log("Payout account:", ACCOUNT_NUMBER, "Bank code:", BANK_CODE + bankLabel + "\n");

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

  const testOwnerKey = process.env.OFFRAMP_TEST_OWNER_PRIVATE_KEY?.trim();

  // 2) Find user: by wallet (normal path) or any user when using OFFRAMP_TEST_OWNER_PRIVATE_KEY
  let userRow: { id: string; email: string | null; smart_wallet_address: string | null; smart_wallet_owner_encrypted: string | null };
  if (testOwnerKey) {
    const { data: users, error: listErr } = await supabaseAdmin
      .from("users")
      .select("id, email, smart_wallet_address, smart_wallet_owner_encrypted")
      .limit(1)
      .order("created_at", { ascending: true });
    if (listErr || !users?.length) {
      console.error("No user in DB (need at least one for payout row):", listErr);
      process.exit(1);
    }
    userRow = users[0];
    console.log("Using test key; linking payout to user:", userRow.email, "id:", userRow.id);
  } else {
    const { data: u, error: userErr } = await supabaseAdmin
      .from("users")
      .select("id, email, smart_wallet_address, smart_wallet_owner_encrypted")
      .in("smart_wallet_address", [depositAddress, normalized])
      .limit(1)
      .maybeSingle();
    if (userErr || !u?.id) {
      console.error("No user found with smart_wallet_address =", depositAddress);
      console.error("Tip: set OFFRAMP_TEST_OWNER_PRIVATE_KEY (hex) in .env.local to test with this wallet.");
      process.exit(1);
    }
    userRow = u;
    console.log("Found user:", userRow.email, "id:", userRow.id);
  }

  // 3) Verify bank account (Flutterwave)
  const verifyResult = await verifyBankAccount(ACCOUNT_NUMBER, BANK_CODE);
  if (!verifyResult.success || !verifyResult.data?.accountName) {
    const errMsg = !verifyResult.success && "error" in verifyResult ? verifyResult.error : "Could not verify bank account.";
    console.error("Flutterwave account verification failed:", errMsg);
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
    bank_name: BANK_CODE === "058" ? "Guaranty Trust Bank" : "OPay",
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
  const poolAddress = getOfframpPoolAddress();
  let sweepResult: { success: boolean; txHash?: string; sendAmount?: string; error?: string };

  if (testOwnerKey) {
    console.log("\nRunning sweep with OFFRAMP_TEST_OWNER_PRIVATE_KEY...");
    const { sweepSendFromSmartWalletWithKey } = await import("../lib/offramp-sweep-payout");
    sweepResult = await sweepSendFromSmartWalletWithKey(depositAddress, testOwnerKey, poolAddress);
  } else {
    console.log("\nRunning sweep + Flutterwave payout...");
    const result = await processOneOfframpPayout(row as OfframpRow);
    if (result.success) {
      console.log("\nSuccess:");
      console.log("  SEND swept:", result.sendAmount);
      console.log("  NGN sent:", result.ngnAmount);
      console.log("  Tx hash:", result.sweepTxHash);
      return;
    }
    console.error("\nFailed:", result.error);
    process.exit(1);
  }

  if (!sweepResult.success || !sweepResult.sendAmount) {
    console.error("\nSweep failed:", sweepResult.error);
    process.exit(1);
  }

  const sendAmount = sweepResult.sendAmount;
  const ngnPayout = Math.floor(parseFloat(sendAmount) * rate);
  const { createTransfer } = await import("../lib/flutterwave");
  const { getMinimumPurchase } = await import("../lib/settings");
  const minPayoutNgn = await getMinimumPurchase();
  if (ngnPayout < minPayoutNgn) {
    console.error("\nNGN amount too small:", ngnPayout, "min", minPayoutNgn);
    process.exit(1);
  }

  const reference = `OFFRAMP-${transactionId}-${Date.now()}`;
  const transferResult = await createTransfer({
    accountBank: BANK_CODE,
    accountNumber: ACCOUNT_NUMBER.replace(/\D/g, "").slice(0, 10),
    amount: ngnPayout,
    currency: "NGN",
    narration: `SEND off-ramp payout ${transactionId}`,
    reference,
  });

  if (!transferResult.success) {
    console.error("\nFlutterwave transfer failed:", transferResult.error);
    process.exit(1);
  }

  const { error: updateErr } = await supabaseAdmin
    .from("offramp_transactions")
    .update({
      status: "completed",
      swap_tx_hash: sweepResult.txHash,
      token_amount: sendAmount,
      ngn_amount: ngnPayout,
      payment_reference: reference,
      paid_at: new Date().toISOString(),
      token_received_at: new Date().toISOString(),
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("transaction_id", transactionId);

  if (updateErr) {
    console.error("DB update error:", updateErr);
    process.exit(1);
  }

  console.log("\nSuccess:");
  console.log("  SEND swept:", sendAmount);
  console.log("  NGN sent:", ngnPayout, "to", ACCOUNT_NUMBER);
  console.log("  Tx hash:", sweepResult.txHash);
}

main();
