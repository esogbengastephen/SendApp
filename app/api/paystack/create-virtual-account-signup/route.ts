import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { supabase } from "@/lib/supabase";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API_BASE = "https://api.paystack.co";

/**
 * Create dedicated virtual account during user signup
 * No wallet address required - just email
 * Account name will be "Send App" and bank will be Wema Bank
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

    // Check if user already has a virtual account
    const { data: existingUser } = await supabase
      .from("users")
      .select("default_virtual_account_number, paystack_customer_code")
      .eq("id", userId)
      .single();

    if (existingUser?.default_virtual_account_number) {
      console.log(`[Signup VA] User already has account: ${existingUser.default_virtual_account_number}`);
      return NextResponse.json({
        success: true,
        data: {
          accountNumber: existingUser.default_virtual_account_number,
          alreadyExists: true,
        },
      });
    }

    // Step 1: Create Paystack customer with "Send App" name
    console.log(`[Signup VA] Creating Paystack customer for ${email}`);
    
    let customerCode = existingUser?.paystack_customer_code;
    
    if (!customerCode) {
      try {
        const customerResponse = await axios.post(
          `${PAYSTACK_API_BASE}/customer`,
          {
            email: email,
            first_name: "App",
            last_name: "Send",
            phone: "+2348000000000", // Default phone number for virtual accounts
            metadata: {
              user_id: userId,
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
        console.log(`[Signup VA] ✅ Customer created: ${customerCode}`);
      } catch (customerError: any) {
        // Customer might already exist, try to fetch
        if (customerError.response?.status === 400) {
          console.log(`[Signup VA] Fetching existing customer...`);
          try {
            const fetchResponse = await axios.get(
              `${PAYSTACK_API_BASE}/customer/${email}`,
              {
                headers: {
                  Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                },
              }
            );
            customerCode = fetchResponse.data.data.customer_code;
            console.log(`[Signup VA] ✅ Fetched customer: ${customerCode}`);
          } catch (fetchError) {
            console.error("[Signup VA] Failed to fetch customer:", fetchError);
            throw customerError;
          }
        } else {
          throw customerError;
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
        accountName: dva.account_name, // Will be "Send App"
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

