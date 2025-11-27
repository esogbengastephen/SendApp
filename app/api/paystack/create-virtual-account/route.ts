import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { supabase } from "@/lib/supabase";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API_BASE = "https://api.paystack.co";

/**
 * Create a dedicated virtual account for a user's wallet
 * This gives each user a unique bank account number for payments
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, email, walletAddress } = await request.json();

    console.log(`[Create Virtual Account] Request for user ${userId}, wallet ${walletAddress}`);

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

    // Check if user was reset (to create new Paystack customer)
    const { data: userData } = await supabase
      .from("users")
      .select("account_reset_at, is_blocked")
      .eq("id", userId)
      .single();

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

    // Check if user already has a virtual account for this wallet
    const { data: existingWallet, error: checkError } = await supabase
      .from("user_wallets")
      .select("*")
      .eq("user_id", userId)
      .eq("wallet_address", walletAddress.toLowerCase())
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("[Create Virtual Account] Error checking existing wallet:", checkError);
      return NextResponse.json(
        { success: false, error: "Database error" },
        { status: 500 }
      );
    }

    // If already has virtual account, return it
    if (existingWallet?.virtual_account_number) {
      console.log(`[Create Virtual Account] User already has virtual account: ${existingWallet.virtual_account_number}`);
      return NextResponse.json({
        success: true,
        data: {
          accountNumber: existingWallet.virtual_account_number,
          bankName: existingWallet.virtual_account_bank_name,
          accountName: `Send Africa`,
          customerCode: existingWallet.paystack_customer_code,
          alreadyExists: true,
        },
      });
    }

    // Step 1: Create or update Paystack customer
    console.log(`[Create Virtual Account] Creating Paystack customer for ${email}${wasReset ? ' (reset user - will create new customer)' : ''}`);
    
    let customerCode = existingWallet?.paystack_customer_code;
    
    if (!customerCode) {
      try {
        // If user was reset, use unique email to force new customer creation
        const customerEmail = wasReset 
          ? `${email.split('@')[0]}+reset${Date.now()}@${email.split('@')[1]}` // email+reset1234567890@domain.com
          : email;
        
        const customerResponse = await axios.post(
          `${PAYSTACK_API_BASE}/customer`,
          {
            email: customerEmail,
            first_name: `App`,
            last_name: `Send`,
            phone: "+2348000000000", // Default phone number for virtual accounts
            metadata: {
              user_id: userId,
              wallet_address: walletAddress,
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
        console.log(`[Create Virtual Account] ✅ Customer created: ${customerCode}${wasReset ? ' (for reset user)' : ''}`);
      } catch (customerError: any) {
        // If user was reset, don't fetch old customer - force new creation
        if (wasReset) {
          console.log(`[Create Virtual Account] Reset user - forcing new customer creation with unique email`);
          // Try again with timestamp-based email
          try {
            const uniqueEmail = `${email.split('@')[0]}+reset${Date.now()}@${email.split('@')[1]}`;
            const retryResponse = await axios.post(
              `${PAYSTACK_API_BASE}/customer`,
              {
                email: uniqueEmail,
                first_name: `App`,
                last_name: `Send`,
                phone: "+2348000000000",
                metadata: {
                  user_id: userId,
                  wallet_address: walletAddress,
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
          if (customerError.response?.status === 400) {
            console.log(`[Create Virtual Account] Customer might exist, fetching...`);
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
              console.log(`[Create Virtual Account] ✅ Fetched existing customer: ${customerCode}`);
            } catch (fetchError) {
              console.error("[Create Virtual Account] Failed to fetch customer:", fetchError);
              throw customerError;
            }
          } else {
            throw customerError;
          }
        }
      }
    }

    // Step 2: Create dedicated virtual account
    console.log(`[Create Virtual Account] Creating dedicated virtual account for customer ${customerCode}`);
    
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

    // Step 3: Update user_wallets table
    const updateData = {
      paystack_customer_code: customerCode,
      paystack_dedicated_account_id: dva.id.toString(),
      virtual_account_number: dva.account_number,
      virtual_account_bank: dva.bank.slug,
      virtual_account_bank_name: dva.bank.name,
      virtual_account_assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existingWallet) {
      // Update existing wallet
      const { error: updateError } = await supabase
        .from("user_wallets")
        .update(updateData)
        .eq("id", existingWallet.id);

      if (updateError) {
        console.error("[Create Virtual Account] Error updating user_wallets:", updateError);
        return NextResponse.json(
          { success: false, error: "Failed to save virtual account" },
          { status: 500 }
        );
      }
    } else {
      // Create new wallet entry
      const { error: insertError } = await supabase
        .from("user_wallets")
        .insert({
          user_id: userId,
          wallet_address: walletAddress.toLowerCase(),
          ...updateData,
        });

      if (insertError) {
        console.error("[Create Virtual Account] Error inserting user_wallets:", insertError);
        return NextResponse.json(
          { success: false, error: "Failed to save virtual account" },
          { status: 500 }
        );
      }
    }

    // Step 4: Also update users table with default account
    await supabase
      .from("users")
      .update({
        default_virtual_account_number: dva.account_number,
        default_virtual_account_bank: dva.bank.name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    console.log(
      `[Create Virtual Account] ✅ SUCCESS - Virtual account ${dva.account_number} assigned to user ${userId}`
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

