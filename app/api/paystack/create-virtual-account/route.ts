import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { supabase } from "@/lib/supabase";
import { PAYSTACK_DUMMY_EMAIL } from "@/lib/constants";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API_BASE = "https://api.paystack.co";

/**
 * Create a dedicated virtual account for a user (EMAIL-BASED)
 * Each user (email) gets ONE virtual account that works for ALL their wallets
 * This ensures payments are always linked to the user's email, not wallet address
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, email, walletAddress } = await request.json();

    console.log(`[Create Virtual Account] Request for user ${userId} (email: ${email}), wallet ${walletAddress}`);

    if (!userId || !email || !walletAddress) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: userId, email, walletAddress" },
        { status: 400 }
      );
    }

    if (!PAYSTACK_SECRET_KEY) {
      console.error("[Create Virtual Account] PAYSTACK_SECRET_KEY not configured");
      return NextResponse.json(
        { success: false, error: "Payment system not configured" },
        { status: 500 }
      );
    }

    // ============================================
    // STEP 1: Check if user already has a virtual account (EMAIL-BASED)
    // ============================================
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("default_virtual_account_number, default_virtual_account_bank, paystack_customer_code, account_reset_at, is_blocked")
      .eq("id", userId)
      .single();

    if (userError && userError.code !== "PGRST116") {
      console.error("[Create Virtual Account] Error fetching user:", userError);
      return NextResponse.json(
        { success: false, error: "Database error" },
        { status: 500 }
      );
    }

    if (userData?.is_blocked) {
      console.log(`[Create Virtual Account] ❌ User ${userId} is blocked. Cannot create DVA.`);
      return NextResponse.json(
        { 
          success: false, 
          error: "Your account has been blocked. Please contact support." 
        },
        { status: 403 }
      );
    }

    const wasReset = !!userData?.account_reset_at;

    // If user already has a virtual account, return it (regardless of wallet address)
    if (userData?.default_virtual_account_number) {
      console.log(`[Create Virtual Account] ✅ User already has virtual account: ${userData.default_virtual_account_number} (EMAIL-BASED)`);
      
      // Ensure wallet is linked to user (for tracking purposes)
      await supabase
        .from("user_wallets")
        .upsert({
          user_id: userId,
          wallet_address: walletAddress.toLowerCase(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,wallet_address"
        });

      return NextResponse.json({
        success: true,
        data: {
          accountNumber: userData.default_virtual_account_number,
          bankName: userData.default_virtual_account_bank,
          accountName: `Send Africa`,
          customerCode: userData.paystack_customer_code,
          alreadyExists: true,
        },
      });
    }

    // ============================================
    // STEP 2: User doesn't have virtual account - create one (EMAIL-BASED)
    // ============================================
    let customerCode = userData?.paystack_customer_code;
    
    if (!customerCode) {
      try {
        // Create Paystack customer with DUMMY EMAIL (prevents Paystack from sending emails)
        // Real user email stored in metadata for our use
        const customerResponse = await axios.post(
          `${PAYSTACK_API_BASE}/customer`,
          {
            email: PAYSTACK_DUMMY_EMAIL, // Dummy email - Paystack won't send emails to users
            first_name: `App`,
            last_name: `Send`,
            phone: "+2348000000000",
            metadata: {
              user_id: userId,
              user_email: email, // Store REAL email in metadata (for our email system)
              original_email: email,
              reset_user: wasReset,
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
        console.log(`[Create Virtual Account] ✅ Customer created: ${customerCode} (EMAIL-BASED)`);
      } catch (customerError: any) {
        // If user was reset, don't fetch old customer - force new creation
        if (wasReset) {
          console.log(`[Create Virtual Account] Reset user - forcing new customer creation`);
          try {
            const retryResponse = await axios.post(
              `${PAYSTACK_API_BASE}/customer`,
              {
                email: PAYSTACK_DUMMY_EMAIL, // Dummy email - Paystack won't send emails
                first_name: `App`,
                last_name: `Send`,
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
            console.log(`[Create Virtual Account] ✅ New customer created for reset user: ${customerCode}`);
          } catch (retryError: any) {
            console.error("[Create Virtual Account] Failed to create new customer for reset user:", retryError.response?.data || retryError.message);
            throw retryError;
          }
        } else {
          // Original logic for non-reset users
          // Note: Since we use dummy email, we can't search by email
          // We'll need to get customer_code from database or create new one
          if (customerError.response?.status === 400) {
            console.log(`[Create Virtual Account] Customer creation failed, checking if customer_code exists in database...`);
            // Check if we have customer_code stored in users table
            if (userData?.paystack_customer_code) {
              customerCode = userData.paystack_customer_code;
              console.log(`[Create Virtual Account] ✅ Using existing customer_code from database: ${customerCode}`);
            } else {
              // Try to fetch by dummy email (might return multiple, but we'll use first one)
              try {
                const fetchResponse = await axios.get(
                  `${PAYSTACK_API_BASE}/customer/${PAYSTACK_DUMMY_EMAIL}`,
                  {
                    headers: {
                      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    },
                  }
                );
                // If multiple customers with same email, we need to find by metadata
                // For now, create new customer with unique identifier in metadata
                throw customerError; // Will create new customer
              } catch (fetchError) {
                console.error("[Create Virtual Account] Failed to fetch customer:", fetchError);
                throw customerError;
              }
            }
          } else {
            throw customerError;
          }
        }
      }
    }

    // Step 3: Create dedicated virtual account (ONE per user/email)
    console.log(`[Create Virtual Account] Creating dedicated virtual account for customer ${customerCode} (EMAIL-BASED)`);
    
    const virtualAccountResponse = await axios.post(
      `${PAYSTACK_API_BASE}/dedicated_account`,
      {
        customer: customerCode,
        preferred_bank: "wema-bank", // Use "test-bank" for testing, "wema-bank" for production
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const dva = virtualAccountResponse.data.data;
    console.log(`[Create Virtual Account] ✅ Virtual account created: ${dva.account_number} (${dva.bank.name})`);

    // Step 4: Store virtual account in USERS table (EMAIL-BASED, not wallet-based)
    const { error: updateUserError } = await supabase
      .from("users")
      .update({
        paystack_customer_code: customerCode,
        default_virtual_account_number: dva.account_number,
        default_virtual_account_bank: dva.bank.name,
        virtual_account_assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateUserError) {
      console.error("[Create Virtual Account] Error updating users table:", updateUserError);
      return NextResponse.json(
        { success: false, error: "Failed to save virtual account" },
        { status: 500 }
      );
    }

    // Step 5: Link wallet to user (for tracking, but virtual account is in users table)
    await supabase
      .from("user_wallets")
      .upsert({
        user_id: userId,
        wallet_address: walletAddress.toLowerCase(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,wallet_address"
      });

    console.log(
      `[Create Virtual Account] ✅ SUCCESS - Virtual account ${dva.account_number} assigned to user ${userId} (email: ${email}) - EMAIL-BASED`
    );

    return NextResponse.json({
      success: true,
      data: {
        accountNumber: dva.account_number,
        bankName: dva.bank.name,
        accountName: dva.account_name,
        customerCode: customerCode,
        alreadyExists: false,
      },
    });
  } catch (error: any) {
    console.error("[Create Virtual Account] Error:", error.response?.data || error.message);
    
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

