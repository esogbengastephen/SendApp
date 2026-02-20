/**
 * Test Flutterwave NGN transfer only (no sweep, no off-ramp DB).
 * Use this to verify your Flutterwave keys and that payouts reach a bank account.
 *
 * Usage:
 *   npx tsx scripts/test-flutterwave-transfer.ts
 *   npx tsx scripts/test-flutterwave-transfer.ts 0218921864 058 100
 *
 * Env: Flutterwave (FLUTTERWAVE_SECRET_KEY or FLW_CLIENT_ID + FLW_CLIENT_SECRET).
 *
 * Args: [accountNumber] [bankCode] [amountNGN]
 *   Default: 0218921864, 058 (GTBank), 100 NGN
 */

import * as dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const args = process.argv.slice(2);
const accountNumber = (args[0] ?? "0218921864").replace(/\D/g, "").slice(0, 10);
const bankCode = (args[1] ?? "058").trim();
const amountNGN = Math.round(Number(args[2]) || 100);

async function main() {
  const { createTransfer, getAccountBalance } = await import("../lib/flutterwave");

  console.log("Flutterwave transfer test\n");
  console.log("Destination:", accountNumber, "| Bank code:", bankCode, "(GTBank) | Amount: ₦" + amountNGN);
  console.log("");

  let balanceRes: { success?: boolean; data?: unknown } | undefined;
  try {
    balanceRes = await getAccountBalance();
  } catch {
    balanceRes = undefined;
  }
  if (balanceRes?.success && balanceRes.data != null) {
    const data = balanceRes.data as { available_balance?: number; balance?: number };
    const bal = Number(data.available_balance ?? data.balance ?? 0) || 0;
    console.log("Flutterwave balance (approx): ₦" + bal);
  } else {
    console.log("(Balance check skipped or not configured)\n");
  }

  const ref = "TEST-FW-" + Date.now();
  const result = await createTransfer({
    accountBank: bankCode,
    accountNumber,
    amount: amountNGN,
    currency: "NGN",
    narration: "Flutterwave transfer test",
    reference: ref,
  });

  if (result.success) {
    console.log("Transfer initiated successfully.");
    console.log("Reference:", ref);
    if (result.data) console.log("Response:", JSON.stringify(result.data, null, 2));
  } else {
    console.log("Transfer failed:", result.error);
    if (result.details) console.log("Details:", JSON.stringify(result.details, null, 2));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
