/**
 * Test complete off-ramp flow for a wallet
 * This will:
 * 1. Check if transaction exists, if not create one
 * 2. Check wallet balance
 * 3. Trigger swap if tokens found
 */

const walletAddress = "0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2";
const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// You'll need to set this
const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLETS?.split(",")[0] || "";

async function testFlow() {
  console.log(`\n🧪 Testing Off-Ramp Flow`);
  console.log(`========================\n`);
  console.log(`Wallet: ${walletAddress}\n`);

  if (!ADMIN_WALLET) {
    console.log("⚠️  Please set NEXT_PUBLIC_ADMIN_WALLETS in .env.local\n");
    console.log("   Or set it here: const ADMIN_WALLET = 'your_wallet_address';\n");
    return;
  }

  // Step 1: Check if transaction exists
  console.log(`1️⃣ Checking for existing transaction...\n`);
  try {
    const listResponse = await fetch(`${API_URL}/api/admin/offramp?adminWallet=${ADMIN_WALLET}&status=all`);
    const listData = await listResponse.json();

    if (!listData.success) {
      console.error(`❌ Failed to fetch transactions: ${listData.error}\n`);
      return;
    }

    const transactions = listData.transactions || [];
    const existingTx = transactions.find(
      (tx: any) => tx.unique_wallet_address?.toLowerCase() === walletAddress.toLowerCase()
    );

    if (existingTx) {
      console.log(`✅ Found existing transaction:`);
      console.log(`   ID: ${existingTx.transaction_id}`);
      console.log(`   Status: ${existingTx.status}`);
      console.log(`   Token: ${existingTx.token_symbol || "Not detected"} ${existingTx.token_amount || ""}\n`);

      // Step 2: Try restart-by-wallet (will check balance and swap)
      console.log(`2️⃣ Triggering restart & swap...\n`);
      const restartResponse = await fetch(`${API_URL}/api/admin/offramp/restart-by-wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminWallet: ADMIN_WALLET,
          walletAddress: walletAddress,
        }),
      });

      const restartData = await restartResponse.json();

      if (restartData.success) {
        console.log(`✅ Restart & Swap Successful!\n`);
        console.log(`   Transaction ID: ${restartData.transactionId}`);
        console.log(`   Swap TX: ${restartData.swapTxHash || "Processing..."}`);
        console.log(`   USDC: ${restartData.usdcAmount || "Calculating..."}\n`);
      } else {
        console.log(`❌ Restart Failed: ${restartData.error}\n`);
        if (restartData.hint) {
          console.log(`   Hint: ${restartData.hint}\n`);
        }
      }
    } else {
      console.log(`⚠️  No transaction found for this wallet\n`);
      console.log(`💡 Options:`);
      console.log(`   1. Create transaction via frontend: ${API_URL}/offramp`);
      console.log(`   2. Or use manual-swap which can work without transaction\n`);
      
      // Try manual swap (can work even without transaction)
      console.log(`3️⃣ Trying manual swap (will create transaction if needed)...\n`);
      const manualSwapResponse = await fetch(`${API_URL}/api/admin/offramp/manual-swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminWallet: ADMIN_WALLET,
          walletAddress: walletAddress,
          tokenAmount: "50", // User said they have 50 SEND
          tokenAmountRaw: "50000000000000000000", // 50 * 10^18
        }),
      });

      const manualSwapData = await manualSwapResponse.json();

      if (manualSwapData.success) {
        console.log(`✅ Manual Swap Triggered!\n`);
        console.log(`   Transaction ID: ${manualSwapData.transactionId}`);
        console.log(`   Wallet: ${manualSwapData.walletAddress}\n`);
        console.log(`   Swap Result:`, JSON.stringify(manualSwapData.swapResult, null, 2));
      } else {
        console.log(`❌ Manual Swap Failed: ${manualSwapData.error}\n`);
      }
    }
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}\n`);
  }
}

testFlow();

