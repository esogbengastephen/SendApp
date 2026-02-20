/**
 * Create a Zainpay static virtual account and use it as the transfer source.
 *
 * Run once to create the VA, then set ZAINPAY_SOURCE_ACCOUNT_NUMBER and
 * ZAINPAY_SOURCE_BANK_CODE in .env.local with the printed values.
 * Fund this virtual account (or your Zainbox) before making transfers.
 *
 * Usage:
 *   npx tsx scripts/create-zainpay-virtual-account.ts
 *   ZAINPAY_SANDBOX=false npx tsx scripts/create-zainpay-virtual-account.ts   # live
 *
 * Env: ZAINPAY_PUBLIC_KEY, ZAINPAY_ZAINBOX_CODE. For LIVE, set ZAINPAY_VA_BVN (11-digit BVN).
 * Optional: ZAINPAY_VA_FIRST_NAME, ZAINPAY_VA_SURNAME, ZAINPAY_VA_EMAIL, ZAINPAY_VA_MOBILE,
 *   ZAINPAY_VA_DOB, ZAINPAY_VA_GENDER, ZAINPAY_VA_ADDRESS, ZAINPAY_VA_TITLE,
 *   ZAINPAY_VA_STATE, ZAINPAY_VA_BANK_TYPE (gtBank|fidelity|fcmb)
 */

import * as dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const first = process.env.ZAINPAY_VA_FIRST_NAME ?? "Send";
const surname = process.env.ZAINPAY_VA_SURNAME ?? "Xino";
const email = process.env.ZAINPAY_VA_EMAIL ?? process.env.ADMIN_EMAIL ?? "admin@example.com";
const mobile = process.env.ZAINPAY_VA_MOBILE ?? "08000000000";
const dob = process.env.ZAINPAY_VA_DOB ?? "01-01-1990";
const gender = (process.env.ZAINPAY_VA_GENDER === "F" ? "F" : "M") as "M" | "F";
const address = process.env.ZAINPAY_VA_ADDRESS ?? "Lagos";
const title = process.env.ZAINPAY_VA_TITLE ?? "Mr";
const state = process.env.ZAINPAY_VA_STATE ?? "Lagos";
const bvn = process.env.ZAINPAY_VA_BVN ?? "";
const bankType = (process.env.ZAINPAY_VA_BANK_TYPE === "fidelity" ? "fidelity" : process.env.ZAINPAY_VA_BANK_TYPE === "fcmb" ? "fcmb" : "gtBank") as "gtBank" | "fidelity" | "fcmb";

async function main() {
  const { createStaticVirtualAccount, getZainpayBankCodeFromBankType } = await import("../lib/zainpay");
  const isSandbox = process.env.ZAINPAY_SANDBOX === "true" || process.env.ZAINPAY_SANDBOX === "1";

  if (!bvn || bvn.replace(/\D/g, "").length !== 11) {
    console.error("A valid 11-digit BVN is required for creating a static virtual account (live).");
    console.error("Set ZAINPAY_VA_BVN in .env.local, e.g. ZAINPAY_VA_BVN=22345678901");
    process.exit(1);
  }

  console.log("Zainpay: Create static virtual account");
  console.log("Mode:", isSandbox ? "SANDBOX" : "LIVE");
  console.log("Bank type:", bankType);
  console.log("");

  const result = await createStaticVirtualAccount({
    bankType,
    firstName: first,
    surname,
    email,
    mobileNumber: mobile,
    dob,
    gender,
    address,
    title,
    state,
    bvn,
  });

  if (!result.success) {
    console.error("Create failed:", result.error);
    if (result.details) console.error("Details:", JSON.stringify(result.details, null, 2));
    process.exit(1);
  }

  const { accountNumber, bankName, accountName } = result.data!;
  const sourceBankCode = await getZainpayBankCodeFromBankType(bankName);

  console.log("Virtual account created successfully.\n");
  console.log("Account number:", accountNumber);
  console.log("Account name:", accountName);
  console.log("Bank name:", bankName);
  console.log("Zainpay source bank code:", sourceBankCode || "(resolve from bank list if empty)");
  console.log("");
  console.log("Add these to your .env.local and use this VA as the transfer source:");
  console.log("");
  console.log("ZAINPAY_SOURCE_ACCOUNT_NUMBER=" + accountNumber);
  console.log("ZAINPAY_SOURCE_BANK_CODE=" + (sourceBankCode || "035"));
  console.log("");
  console.log("Then fund this virtual account (or your Zainbox) before making transfers.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
