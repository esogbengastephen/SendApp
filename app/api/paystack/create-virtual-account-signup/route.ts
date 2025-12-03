import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { supabase } from "@/lib/supabase";
import { PAYSTACK_DUMMY_EMAIL } from "@/lib/constants";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API_BASE = "https://api.paystack.co";

/**
 * Create dedicated virtual account during user signup
 * No wallet address required - just email
 * Account name will be "FlipPay" and bank will be Wema Bank
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await request.json();

    console.log(`[Signup VA] Creating virtual account for user ${userId}`);

    if (!userId || !email) {
      return NextResponse.json(
        { success: false, error: "Missing userId or email" },
        { status: 400 }
      );
    }

    if (!PAYSTACK_SECRET_KEY) {
      return NextResponse.json(
        { success: false, error: "Payment system not configured" },
        { status: 500 }
      );
    }

    // Check if user was reset (to create new Paystack customer)
    const { data: userData } = await supabase
      .from("users")
      .select("account_reset_at, is_blocked, default_virtual_account_number, paystack_customer_code")
      .eq("id", userId)
      .single();

    if (userData?.is_blocked) {
      console.log(`[Signup VA] ❌ User ${userId} is blocked. Cannot create DVA.`);
      return NextResponse.json(
        { 
          success: false, 
          error: "Your account has been blocked. Please contact support." 
        },
        { status: 403 }
      );
    }

    const wasReset = !!userData?.account_reset_at;

    if (userData?.default_virtual_account_number) {
      console.log(`[Signup VA] User already has account: ${userData.default_virtual_account_number}`);
      return NextResponse.json({
        success: true,
        data: {
          accountNumber: userData.default_virtual_account_number,
          alreadyExists: true,
        },
      });
    }

    // Step 1: Create Paystack customer with "FlipPay" name
    console.log(`[Signup VA] Creating Paystack customer for ${email}${wasReset ? ' (reset user - will create new customer)' : ''}`);
    
    let customerCode = userData?.paystack_customer_code;
    
    if (!customerCode) {
      try {
        // Create Paystack customer with DUMMY EMAIL (prevents Paystack from sending emails)
        // Real user email stored in metadata for our use
        const customerResponse = await axios.post(
          `${PAYSTACK_API_BASE}/customer`,
          {
            email: PAYSTACK_DUMMY_EMAIL, // Dummy email - Paystack won't send emails to users
            first_name: "Flip",
            last_name: "Pay",
            phone: "+2348000000000", // Default phone number for virtual accounts
            metadata: {
              user_id: userId,
              user_email: email, // Store REAL email in metadata (for our email system)
              original_email: email, // Store original email
              reset_user: wasReset, // Flag if this is a reset user
            },
          },
          {
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        customerCode = customerResponse.data.data.customer_code;
        console.log(`[Signup VA] ✅ Customer created: ${customerCode}${wasReset ? ' (for reset user)' : ''}`);
      } catch (customerError: any) {
        // If user was reset, don't fetch old customer - force new creation
        if (wasReset) {
          console.log(`[Signup VA] Reset user - forcing new customer creation`);
          // Try again with dummy email
          try {
            const retryResponse = await axios.post(
              `${PAYSTACK_API_BASE}/customer`,
              {
                email: PAYSTACK_DUMMY_EMAIL, // Dummy email - Paystack won't send emails
                first_name: "Flip",
                last_name: "Pay",
                phone: "+2348000000000",
                metadata: {
                  user_id: userId,
                  user_email: email, // Real email in metadata
                  original_email: email,
                  reset_user: true,
                },
              },
              {
                headers: {
                  Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                  "Content-Type": "application/json",
                },
              }
            );
            customerCode = retryResponse.data.data.customer_code;
            console.log(`[Signup VA] ✅ New customer created for reset user: ${customerCode}`);
          } catch (retryError: any) {
            console.error("[Signup VA] Failed to create new customer for reset user:", retryError.response?.data || retryError.message);
            throw retryError;
          }
        } else {
          // Original logic for non-reset users
          // Note: Since we use dummy email, we can't search by email
          // We'll check if customer_code exists in database
          if (customerError.response?.status === 400) {
            console.log(`[Signup VA] Customer creation failed, checking if customer_code exists in database...`);
            // Check if we have customer_code stored in users table
            if (userData?.paystack_customer_code) {
              customerCode = userData.paystack_customer_code;
              console.log(`[Signup VA] ✅ Using existing customer_code from database: ${customerCode}`);
            } else {
              console.error("[Signup VA] Failed to create/fetch customer:", customerError);
              throw customerError;
            }
          } else {
            throw customerError;
          }
        }
      }
    }

    // Step 2: Create dedicated virtual account (Wema Bank)
    console.log(`[Signup VA] Creating Wema Bank virtual account for ${customerCode}`);
    
    const virtualAccountResponse = await axios.post(
      `${PAYSTACK_API_BASE}/dedicated_account`,
      {
        customer: customerCode,
        preferred_bank: "wema-bank",
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const dva = virtualAccountResponse.data.data;
    console.log(`[Signup VA] ✅ Virtual account: ${dva.account_number} (${dva.bank.name})`);
    console.log(`[Signup VA] Account name: ${dva.account_name}`);

    // Step 3: Update users table
    const { error: updateError } = await supabase
      .from("users")
      .update({
        paystack_customer_code: customerCode,
        default_virtual_account_number: dva.account_number,
        default_virtual_account_bank: dva.bank.name,
        virtual_account_assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[Signup VA] Error updating users:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to save virtual account" },
        { status: 500 }
      );
    }

    console.log(`[Signup VA] ✅ SUCCESS - Account ${dva.account_number} assigned to ${email}`);

    return NextResponse.json({
      success: true,
      data: {
        accountNumber: dva.account_number,
        bankName: dva.bank.name,
        accountName: dva.account_name, // Will be "FlipPay"
        customerCode: customerCode,
      },
    });
  } catch (error: any) {
    console.error("[Signup VA] Error:", error.response?.data || error.message);
    
    return NextResponse.json(
      {
        success: false,
        error: error.response?.data?.message || "Failed to create virtual account",
        details: error.response?.data || error.message,
      },
      { status: 500 }
    );
  }
}

