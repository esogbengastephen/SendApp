/**
 * One-off: Delete ALL pending transactions from the database.
 * Use before implementing smarter cleanup (verify payment → distribute or delete).
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach((line) => {
    const [key, ...values] = line.split("=");
    if (key && values.length > 0) {
      const value = values.join("=").trim();
      process.env[key.trim()] = value;
    }
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  const { data: pending, error: fetchError } = await supabase
    .from("transactions")
    .select("transaction_id")
    .eq("status", "pending");

  if (fetchError) {
    console.error("❌ Error fetching pending transactions:", fetchError);
    process.exit(1);
  }

  const count = pending?.length ?? 0;
  if (count === 0) {
    console.log("✅ No pending transactions found. Nothing to delete.");
    return;
  }

  const { error: deleteError } = await supabase
    .from("transactions")
    .delete()
    .eq("status", "pending");

  if (deleteError) {
    console.error("❌ Error deleting pending transactions:", deleteError);
    process.exit(1);
  }

  console.log(`✅ Deleted ${count} pending transaction(s) from the database.`);
}

main();
