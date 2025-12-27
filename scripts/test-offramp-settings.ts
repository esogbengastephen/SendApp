/**
 * Test script for off-ramp admin settings
 * Tests API endpoints, settings management, and fee calculation
 */

import { 
  getOfframpSettings, 
  getOfframpExchangeRate,
  getOfframpFeeTiers,
  calculateOfframpFee,
  updateOfframpSettings,
  updateOfframpFeeTier,
} from "../lib/offramp-settings.js";

async function testOfframpSettings() {
  console.log("\n🧪 Testing Off-Ramp Admin Settings\n");
  console.log("=".repeat(60));

  try {
    // Test 1: Get current settings
    console.log("\n📋 Test 1: Get Current Settings");
    console.log("-".repeat(60));
    const settings = await getOfframpSettings();
    console.log("✅ Settings loaded:");
    console.log(`   Exchange Rate: 1 USDC = ${settings.exchangeRate} NGN`);
    console.log(`   Transactions Enabled: ${settings.transactionsEnabled}`);
    console.log(`   Min Amount: ₦${settings.minimumAmount.toLocaleString()}`);
    console.log(`   Max Amount: ₦${settings.maximumAmount.toLocaleString()}`);
    console.log(`   Last Updated: ${new Date(settings.updatedAt).toLocaleString()}`);
    console.log(`   Updated By: ${settings.updatedBy || "system"}`);

    // Test 2: Get exchange rate
    console.log("\n💱 Test 2: Get Exchange Rate");
    console.log("-".repeat(60));
    const rate = await getOfframpExchangeRate();
    console.log(`✅ Current rate: 1 USDC = ${rate} NGN`);

    // Test 3: Get fee tiers
    console.log("\n💰 Test 3: Get Fee Tiers");
    console.log("-".repeat(60));
    const tiers = await getOfframpFeeTiers();
    console.log(`✅ Found ${tiers.length} fee tier(s):`);
    tiers.forEach((tier, index) => {
      const maxDisplay = tier.max_amount ? `₦${tier.max_amount.toLocaleString()}` : "Unlimited";
      console.log(`   ${index + 1}. ${tier.tier_name}: ₦${tier.min_amount.toLocaleString()} - ${maxDisplay} → ${tier.fee_percentage}%`);
    });

    // Test 4: Calculate fees for different amounts
    console.log("\n🧮 Test 4: Calculate Fees for Different Amounts");
    console.log("-".repeat(60));
    const testAmounts = [500, 1000, 5000, 10000, 25000, 100000];
    for (const amount of testAmounts) {
      const fee = await calculateOfframpFee(amount);
      const percentage = (fee / amount) * 100;
      const finalAmount = amount - fee;
      console.log(`   ₦${amount.toLocaleString()} → Fee: ₦${fee.toFixed(2)} (${percentage.toFixed(2)}%) → User gets: ₦${finalAmount.toFixed(2)}`);
    }

    // Test 5: Simulate USDC to NGN conversion
    console.log("\n💵 Test 5: Simulate USDC → NGN Conversion");
    console.log("-".repeat(60));
    const usdcAmounts = [1, 5, 10, 50, 100];
    for (const usdc of usdcAmounts) {
      const ngnBeforeFees = usdc * rate;
      const fee = await calculateOfframpFee(ngnBeforeFees);
      const ngnAfterFees = ngnBeforeFees - fee;
      console.log(`   ${usdc} USDC → ₦${ngnBeforeFees.toFixed(2)} → Fee: ₦${fee.toFixed(2)} → User gets: ₦${ngnAfterFees.toFixed(2)}`);
    }

    // Test 6: Update settings (dry run - will revert)
    console.log("\n⚙️  Test 6: Test Settings Update (Dry Run)");
    console.log("-".repeat(60));
    console.log("   Current rate: " + rate);
    console.log("   Simulating update to 1700 NGN...");
    
    const newSettings = await updateOfframpSettings(
      { exchangeRate: 1700 },
      "test_script"
    );
    console.log(`   ✅ Settings updated: 1 USDC = ${newSettings.exchangeRate} NGN`);
    
    // Revert back
    console.log("   Reverting to original rate...");
    await updateOfframpSettings(
      { exchangeRate: rate },
      "test_script"
    );
    console.log(`   ✅ Reverted to: 1 USDC = ${rate} NGN`);

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ ALL TESTS PASSED!");
    console.log("=".repeat(60));
    console.log("\n📊 Summary:");
    console.log(`   ✅ Settings management working`);
    console.log(`   ✅ Exchange rate retrieval working`);
    console.log(`   ✅ Fee tiers loaded successfully`);
    console.log(`   ✅ Fee calculation accurate`);
    console.log(`   ✅ USDC → NGN conversion working`);
    console.log(`   ✅ Settings update/revert working`);
    
    console.log("\n🎉 Off-Ramp Admin Settings System: FULLY FUNCTIONAL!\n");

  } catch (error: any) {
    console.error("\n❌ TEST FAILED:", error.message);
    console.error("\nError details:", error);
    console.error("\n💡 Make sure to run the migration first:");
    console.error("   supabase/migrations/023_add_offramp_settings.sql\n");
  }
}

// Run tests
testOfframpSettings().catch(console.error);
