/**
 * Test off-ramp verify-and-create (Smart Wallet deposit address).
 * Prerequisites: dev server running (npm run dev), user exists in DB, Flutterwave + Coinbase env set.
 *
 * Usage:
 *   npx tsx scripts/test-offramp.ts
 *   npx tsx scripts/test-offramp.ts --email you@example.com --account 0123456789 --bank 058
 *
 * Env (or pass as args): OFFRAMP_TEST_EMAIL, OFFRAMP_TEST_ACCOUNT, OFFRAMP_TEST_BANK_CODE (e.g. 058 = GTBank)
 */

import * as dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const BASE = process.env.OFFRAMP_TEST_BASE_URL || "http://localhost:3000";

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : undefined;
  };

  const email = getArg("--email") || process.env.OFFRAMP_TEST_EMAIL;
  const account = getArg("--account") || process.env.OFFRAMP_TEST_ACCOUNT;
  const bankCode = getArg("--bank") || process.env.OFFRAMP_TEST_BANK_CODE || "058";

  console.log("Off-ramp test (verify-and-create)\n");
  console.log("Base URL:", BASE);
  console.log("Email:", email || "(not set)");
  console.log("Account number:", account ? `${account.slice(0, 4)}****` : "(not set)");
  console.log("Bank code:", bankCode);
  console.log();

  if (!email || !account) {
    console.error("Set OFFRAMP_TEST_EMAIL and OFFRAMP_TEST_ACCOUNT in .env.local, or pass --email and --account");
    process.exit(1);
  }

  const accountNumber = account.replace(/\D/g, "").slice(0, 10);
  if (accountNumber.length !== 10) {
    console.error("Account number must be 10 digits");
    process.exit(1);
  }

  try {
    const res = await fetch(`${BASE}/api/offramp/verify-and-create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountNumber,
        bankCode: bankCode.trim(),
        userEmail: email.trim(),
        network: "base",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Request failed:", res.status, data);
      process.exit(1);
    }

    if (!data.success) {
      console.error("API returned success: false", data.error || data);
      process.exit(1);
    }

    console.log("Result:");
    console.log("  accountName:", data.accountName);
    console.log("  depositAddress:", data.depositAddress);
    console.log("  transactionId:", data.transactionId);
    console.log("  message:", data.message);
    console.log("\nNext: Send SEND (on Base) to depositAddress, then run process-payouts or wait for cron.");
  } catch (e) {
    console.error("Request error:", e);
    process.exit(1);
  }
}

main();
