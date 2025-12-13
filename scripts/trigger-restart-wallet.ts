/**
 * Trigger restart/swap for wallet 0xCadCda9Ae9f84B865c18dF5af43E60CaE0b31A52
 * Uses the manual-swap endpoint which finds by wallet address
 */

const walletAddress = "0xCadCda9Ae9f84B865c18dF5af43E60CaE0b31A52";
const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// You'll need to provide your admin wallet address
// This should be one of the wallets in NEXT_PUBLIC_ADMIN_WALLETS
const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLETS?.split(",")[0] || "";

async function triggerRestart() {
  if (!ADMIN_WALLET) {
    console.error("❌ ADMIN_WALLET not set. Please set NEXT_PUBLIC_ADMIN_WALLETS in .env.local");
    console.log("\n💡 To use this script:");
    console.log("   1. Get your admin wallet address from .env.local");
    console.log("   2. Update ADMIN_WALLET in this script");
    console.log("   3. Or set it as an environment variable\n");
    return;
  }

  try {
    console.log(`\n🔄 Triggering restart and swap for wallet: ${walletAddress}\n`);
    console.log(`   Admin Wallet: ${ADMIN_WALLET}\n`);

    const response = await fetch(`${API_URL}/api/admin/offramp/manual-swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminWallet: ADMIN_WALLET,
        walletAddress: walletAddress,
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log(`✅ Restart and Swap Completed!\n`);
      console.log(`   Transaction ID: ${data.transactionId}`);
      console.log(`   Wallet: ${data.walletAddress}`);
      console.log(`   Swap Result:`, data.swapResult);
      console.log(`\n${data.message || ""}\n`);
    } else {
      console.error(`❌ Error: ${data.error || "Failed to trigger restart"}`);
      if (data.hint) {
        console.error(`   Hint: ${data.hint}`);
      }
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

triggerRestart();

