/**
 * Complete standalone off-ramp test
 * This bypasses the API and directly tests the wallet emptying logic
 */

import { emptyWallet } from "../lib/wallet-emptier";
import { getOfframpExchangeRate, calculateOfframpFee } from "../lib/offramp-settings";

// The actual wallet where tokens were sent
const TEST_WALLET = "0x6905325f09Bd165C6F983519070979b9F4B232ec";
const RECEIVER_WALLET = process.env.OFFRAMP_RECEIVER_WALLET_ADDRESS || "0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0";

async function runOfframpTest() {
  console.log("🚀 Complete Off-Ramp Test\n");
  console.log("=" .repeat(60));
  console.log("Test Wallet:", TEST_WALLET);
  console.log("Receiver Wallet:", RECEIVER_WALLET);
  console.log("=" .repeat(60));
  
  try {
    // Step 1: Empty the wallet (swap all tokens to USDC, recover ETH)
    console.log("\n📤 Step 1: Emptying wallet...\n");
    
    const result = await emptyWallet(TEST_WALLET, RECEIVER_WALLET);
    
    console.log("\n✅ Wallet Emptying Complete!\n");
    console.log("Token Swaps:");
    result.swapResults.forEach((swap) => {
      console.log(`  ${swap.fromToken} → ${swap.toToken}: ${swap.success ? "✅" : "❌"}`);
      if (swap.txHash) console.log(`    TX: ${swap.txHash}`);
      if (swap.error) console.log(`    Error: ${swap.error}`);
    });
    
    console.log("\nTransfer Results:");
    result.transferResults.forEach((transfer) => {
      console.log(`  ${transfer.token}: ${transfer.success ? "✅" : "❌"}`);
      if (transfer.txHash) console.log(`    TX: ${transfer.txHash}`);
    });
    
    if (result.ethRecoveryTxHash) {
      console.log("\nETH Recovery:");
      console.log(`  TX: ${result.ethRecoveryTxHash}`);
    }
    
    console.log(`\nFinal USDC Amount: ${result.finalUSDCAmount} USDC`);
    console.log(`Wallet Empty: ${result.walletEmpty ? "✅" : "❌"}`);
    
    // Step 2: Calculate NGN payout
    if (result.finalUSDCAmount > 0) {
      console.log("\n💰 Step 2: Calculating NGN payout...\n");
      
      const exchangeRate = await getOfframpExchangeRate();
      const usdcAmount = parseFloat(result.finalUSDCAmount);
      const ngnBeforeFees = Math.round((usdcAmount * exchangeRate) * 100) / 100;
      const feeNGN = await calculateOfframpFee(ngnBeforeFees);
      const finalNGN = ngnBeforeFees - feeNGN;
      
      console.log(`Exchange Rate: 1 USDC = ${exchangeRate} NGN`);
      console.log(`USDC Amount: ${usdcAmount} USDC`);
      console.log(`NGN Before Fees: ${ngnBeforeFees.toLocaleString()} NGN`);
      console.log(`Fee: ${feeNGN.toLocaleString()} NGN`);
      console.log(`Final NGN Payout: ${finalNGN.toLocaleString()} NGN`);
    }
    
    console.log("\n🎉 Off-Ramp Test Complete!");
    
  } catch (error) {
    console.error("\n❌ Off-Ramp Test Failed:");
    console.error(error);
  }
}

runOfframpTest();
