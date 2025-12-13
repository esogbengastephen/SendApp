/**
 * Script to restart and execute swap for a specific wallet address
 */

const walletAddress = "0xCadCda9Ae9f84B865c18dF5af43E60CaE0b31A52";
const API_URL = "http://localhost:3000";

async function findAndRestartTransaction() {
  try {
    console.log(`\n🔍 Finding transaction for wallet: ${walletAddress}\n`);

    // First, get all transactions to find the one with this wallet
    const listResponse = await fetch(`${API_URL}/api/admin/offramp`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!listResponse.ok) {
      console.error("❌ Failed to fetch transactions");
      return;
    }

    const listData = await listResponse.json();
    
    if (!listData.success || !listData.transactions) {
      console.error("❌ No transactions found");
      return;
    }

    // Find transaction with matching wallet address
    const transaction = listData.transactions.find(
      (tx: any) => tx.unique_wallet_address?.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!transaction) {
      console.error(`❌ No transaction found for wallet: ${walletAddress}`);
      console.log("\n📋 Available transactions:");
      listData.transactions.slice(0, 5).forEach((tx: any) => {
        console.log(`  - ${tx.transaction_id} (${tx.unique_wallet_address})`);
      });
      return;
    }

    console.log(`✅ Found transaction: ${transaction.transaction_id}`);
    console.log(`   Status: ${transaction.status}`);
    console.log(`   Token: ${transaction.token_symbol} ${transaction.token_amount || "N/A"}`);
    console.log(`   Wallet: ${transaction.unique_wallet_address}\n`);

    // Now trigger restart
    console.log(`🔄 Triggering restart and swap...\n`);
    
    const encodedId = encodeURIComponent(transaction.transaction_id);
    const restartResponse = await fetch(`${API_URL}/api/admin/offramp/${encodedId}/restart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        adminWallet: "0x0000000000000000000000000000000000000000" // Will need actual admin wallet
      }),
    });

    const restartData = await restartResponse.json();

    if (restartData.success) {
      console.log(`✅ Restart and Swap Completed!\n`);
      console.log(`   Transaction ID: ${restartData.transactionId}`);
      console.log(`   Swap TX: ${restartData.swapTxHash || "Processing..."}`);
      console.log(`   USDC Amount: ${restartData.usdcAmount || "Calculating..."}`);
      console.log(`   ${restartData.details || ""}\n`);
    } else {
      console.error(`❌ Error: ${restartData.error}`);
      if (restartData.hint) {
        console.error(`   Hint: ${restartData.hint}`);
      }
      if (restartData.swapError) {
        console.error(`   Swap Error: ${restartData.swapError}`);
      }
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

findAndRestartTransaction();

