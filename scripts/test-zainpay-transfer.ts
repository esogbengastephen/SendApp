/**
 * Test Zainpay NGN transfer: Zainbox → bank account.
 *
 * Usage:
 *   npx tsx scripts/test-zainpay-transfer.ts
 *   npx tsx scripts/test-zainpay-transfer.ts 0218921864 058 100
 *
 * Env: ZAINPAY_PUBLIC_KEY, ZAINPAY_ZAINBOX_CODE, ZAINPAY_SOURCE_ACCOUNT_NUMBER,
 *      ZAINPAY_SOURCE_BANK_CODE, ZAINPAY_CALLBACK_URL (optional),
 *      ZAINPAY_SANDBOX=false for live (omit or true for sandbox).
 *
 * Args: [accountNumber] [bankCode] [amountNGN]
 *   Default: 0218921864, 058 (GTBank), 100 NGN
 *   Bank code 058 is resolved to Zainpay's GTBank code via their bank list.
 */

import * as dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const args = process.argv.slice(2);
const accountNumber = (args[0] ?? "0218921864").replace(/\D/g, "").slice(0, 10);
const bankCode = (args[1] ?? "058").trim(); // 058 = GTBank
const amountNGN = Math.round(Number(args[2]) || 100);

async function main() {
  const { createTransfer, getAccountBalance, getZainpayBankCode } = await import("../lib/zainpay");
  const isSandbox = process.env.ZAINPAY_SANDBOX === "true" || process.env.ZAINPAY_SANDBOX === "1";

  console.log("Zainpay transfer test");
  console.log("Mode:", isSandbox ? "SANDBOX" : "LIVE");
  console.log("Destination:", accountNumber, "| Our bank code:", bankCode, "(GTBank) | Amount: ₦" + amountNGN);
  const resolvedCode = await getZainpayBankCode(bankCode);
  if (resolvedCode !== bankCode) console.log("Zainpay bank code (resolved):", resolvedCode);
  console.log("");

  const balanceRes = await getAccountBalance();
  if (balanceRes.success && balanceRes.data) {
    const bal = balanceRes.data.available_balance ?? balanceRes.data.balance ?? 0;
    console.log("Zainpay balance (source): ₦" + bal);
  } else {
    console.log("Zainpay balance check:", balanceRes.error || "not configured");
  }
  console.log("");

  const ref = "TEST-ZAINPAY-" + Date.now();
  const result = await createTransfer({
    accountBank: bankCode,
    accountNumber,
    amount: amountNGN,
    narration: "Zainpay test transfer",
    reference: ref,
  });

  if (result.success) {
    console.log("Transfer initiated successfully.");
    console.log("Reference:", ref);
    if (result.data) console.log("Response:", JSON.stringify(result.data, null, 2));
  } else {
    console.log("Transfer failed:", result.error);
    if (result.details) console.log("Details:", JSON.stringify(result.details, null, 2));
  }
}

main().catch((e: unknown) => {
  const err = e instanceof Error ? e.message : String(e);
  const cause = e instanceof Error && e.cause ? String(e.cause) : "";
  console.error("Error:", err);
  if (cause) console.error("Cause:", cause);
  process.exit(1);
});
