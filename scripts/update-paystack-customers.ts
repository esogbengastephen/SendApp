/**
 * Migration script to update existing Paystack customers to use dummy email
 * This prevents Paystack from sending emails to users
 * 
 * Usage: tsx scripts/update-paystack-customers.ts
 */

import axios from "axios";
import { supabase } from "../lib/supabase";
import { PAYSTACK_DUMMY_EMAIL } from "../lib/constants";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API_BASE = "https://api.paystack.co";

if (!PAYSTACK_SECRET_KEY) {
  console.error("❌ PAYSTACK_SECRET_KEY is not set in environment variables");
  process.exit(1);
}

async function updatePaystackCustomers() {
  console.log("🔄 Starting Paystack customer email update...");
  console.log(`📧 Dummy email: ${PAYSTACK_DUMMY_EMAIL}\n`);

  try {
    // Get all users with Paystack customer codes
    const { data: users, error } = await supabase
      .from("users")
      .select("id, email, paystack_customer_code")
      .not("paystack_customer_code", "is", null);

    if (error) {
      console.error("❌ Error fetching users:", error);
      return;
    }

    if (!users || users.length === 0) {
      console.log("✅ No users with Paystack customer codes found");
      return;
    }

    console.log(`📊 Found ${users.length} users with Paystack customer codes\n`);

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const user of users) {
      if (!user.paystack_customer_code) {
        skipped++;
        continue;
      }

      try {
        console.log(`🔄 Updating customer ${user.paystack_customer_code} for user ${user.email}...`);

        // Update Paystack customer to use dummy email
        const response = await axios.put(
          `${PAYSTACK_API_BASE}/customer/${user.paystack_customer_code}`,
          {
            email: PAYSTACK_DUMMY_EMAIL, // Update to dummy email
            metadata: {
              user_id: user.id,
              user_email: user.email, // Keep real email in metadata
              original_email: user.email,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.status) {
          console.log(`✅ Updated customer ${user.paystack_customer_code}`);
          updated++;
        } else {
          console.log(`⚠️  Customer ${user.paystack_customer_code} update returned false status`);
          failed++;
        }
      } catch (error: any) {
        console.error(`❌ Failed to update customer ${user.paystack_customer_code}:`, error.response?.data?.message || error.message);
        failed++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log("\n📊 Summary:");
    console.log(`✅ Updated: ${updated}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`\n✅ Migration complete!`);

  } catch (error: any) {
    console.error("❌ Migration error:", error);
    process.exit(1);
  }
}

// Run migration
updatePaystackCustomers()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });

