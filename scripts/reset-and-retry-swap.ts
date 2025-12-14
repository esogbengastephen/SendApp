/**
 * Reset transaction status and retry swap
 */

const transactionId = "offramp_Y81PZ3oLNTjY";
const ADMIN_WALLET = "0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0";
const API_URL = "http://localhost:3000";

async function resetAndRetry() {
  console.log(`\n🔄 Resetting transaction ${transactionId} and retrying swap...\n`);

  // Step 1: Reset transaction status via Supabase (we'll use the retry endpoint)
  try {
    console.log("Step 1: Resetting transaction status...");
    const resetResponse = await fetch(`${API_URL}/api/admin/offramp/${encodeURIComponent(transactionId)}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminWallet: ADMIN_WALLET }),
    });

    const resetData = await resetResponse.json();
    console.log("Reset response:", resetData);
    
    if (!resetData.success && !resetData.error?.includes("already completed")) {
      console.error("❌ Failed to reset transaction");
      return;
    }
  } catch (error: any) {
    console.error("❌ Error resetting transaction:", error.message);
    // Continue anyway - we'll try to trigger swap
  }

  // Step 2: Trigger swap
  console.log("\nStep 2: Triggering swap...");
  try {
    const swapResponse = await fetch(`${API_URL}/api/offramp/swap-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId }),
    });

    const swapData = await swapResponse.json();
    console.log("\nSwap response:");
    console.log(JSON.stringify(swapData, null, 2));

    if (swapData.success) {
      console.log("\n✅ Swap triggered successfully!");
      console.log(`   Swap TX Hash: ${swapData.swapTxHash || "Pending..."}`);
      console.log(`   USDC Amount: ${swapData.usdcAmount || "Calculating..."}`);
    } else {
      console.error("\n❌ Swap failed:", swapData.message || swapData.error);
    }
  } catch (error: any) {
    console.error("❌ Error triggering swap:", error.message);
  }
}

resetAndRetry();

