import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

// Load env from .env.local
const envPath = join(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");

envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const [key, ...rest] = trimmed.split("=");
  if (!key || rest.length === 0) return;
  const value = rest.join("=").replace(/^"|"$/g, "");
  process.env[key.trim()] = value;
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const WALLET = process.argv[2];

if (!WALLET) {
  console.error("Usage: npx tsx scripts/debug-offramp-wallet.ts <walletAddress>");
  process.exit(1);
}

async function main() {
  console.log("\n🔍 Debugging offramp transaction for wallet:", WALLET, "\n");

  const { data, error } = await supabase
    .from("offramp_transactions")
    .select("*")
    .eq("unique_wallet_address", WALLET)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("❌ Error fetching transaction:", error);
    process.exit(1);
  }

  if (!data) {
    console.log("❌ No transaction found for this wallet");
    process.exit(0);
  }

  console.log("📋 Transaction row:\n");
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
