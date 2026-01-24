import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { createVirtualAccount, normalizeMobileNumber, isValidNigerianMobile } from "@/lib/flutterwave";

/**
 * Add phone number and create Flutterwave account for existing users
 * This endpoint is for users who already have accounts but don't have phone numbers yet
 * Requires user to be logged in (gets user from session)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, firstName, lastName, userId } = body;

    // Get userId from request body (sent from frontend)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required. Please log in." },
        { status: 401 }
      );
    }

    // Phone number is required
    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Validate phone number
    if (!isValidNigerianMobile(phoneNumber)) {
      const cleaned = phoneNumber.replace(/\D/g, "");
      return NextResponse.json(
        {
          success: false,
          error: `Invalid Nigerian mobile number format. Received: "${phoneNumber}" (${cleaned.length} digits). Expected format: 07034494055, 7034494055, or +2347034494055`,
          received: phoneNumber,
          cleanedLength: cleaned.length,
          cleaned: cleaned,
        },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = normalizeMobileNumber(phoneNumber);

    // Get user's email and current account status
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email, flutterwave_virtual_account_number, mobile_number, is_blocked, display_name")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      console.error("[Flutterwave Add Phone] Error fetching user:", userError);
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    if (userData.is_blocked) {
      return NextResponse.json(
        {
          success: false,
          error: "Your account has been blocked. Please contact support."
        },
        { status: 403 }
      );
    }

    // If user already has NGN account, return it
    if (userData.flutterwave_virtual_account_number) {
      return NextResponse.json({
        success: true,
        message: "You already have an NGN account",
        data: {
          accountNumber: userData.flutterwave_virtual_account_number,
          mobileNumber: userData.mobile_number,
          alreadyExists: true,
        },
      });
    }

    // Check if phone number is already in use by another user
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .eq("mobile_number", normalizedPhone)
      .maybeSingle();

    if (existingUser && existingUser.id !== userId) {
      return NextResponse.json(
        { success: false, error: "This phone number is already registered to another account" },
        { status: 400 }
      );
    }

    // Create DYNAMIC Flutterwave virtual account (temporary, no BVN required)
    // Will be upgraded to STATIC account after BVN verification
    // Note: Dynamic accounts expire after use, but user can verify BVN to get permanent account
    console.log(`[Flutterwave Add Phone] Creating DYNAMIC Flutterwave virtual account (temporary) for existing user ${userData.email} (${normalizedPhone})`);

    const vaResult = await createVirtualAccount({
      email: userData.email,
      firstName: firstName || userData.display_name?.split(" ")[0] || "User",
      lastName: lastName || userData.display_name?.split(" ").slice(1).join(" ") || "Account",
      phoneNumber: normalizedPhone,
      isPermanent: false, // Dynamic account (temporary) - will upgrade to static with BVN
    });

    if (!vaResult.success) {
      console.error(`[Flutterwave Add Phone] Failed to create virtual account:`, vaResult.error);
      console.error(`[Flutterwave Add Phone] Error details:`, vaResult.details);
      
      // Check if it's an authorization error
      // Convert error to string safely before calling toLowerCase
      const errorString = typeof vaResult.error === 'string' 
        ? vaResult.error 
        : vaResult.error?.toString() || '';
      const isAuthError = errorString.toLowerCase().includes("authorization") || 
                         errorString.toLowerCase().includes("invalid") ||
                         vaResult.details?.status === 401 ||
                         vaResult.details?.status === 403;
      
      if (isAuthError) {
        return NextResponse.json(
          {
            success: false,
            error: "Account service configuration error. Please contact support.",
            details: {
              message: vaResult.error,
              hint: "Service configuration issue - contact administrator",
            },
          },
          { status: 401 }
        );
      }
      
      // Convert error to string if it's not already
      const errorMessage = typeof vaResult.error === 'string' 
        ? vaResult.error 
        : vaResult.error?.toString() || "Failed to create NGN account";
      
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          details: vaResult.details,
        },
        { status: 500 }
      );
    }

    const vaData = vaResult.data!;
    console.log(`[Flutterwave Add Phone] ✅ Virtual account created: ${vaData.account_number} (${vaData.bank_name})`);

    // Store virtual account and mobile number in database
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        mobile_number: normalizedPhone,
        flutterwave_virtual_account_number: vaData.account_number,
        flutterwave_virtual_account_bank: vaData.bank_name,
        flutterwave_virtual_account_name: vaData.account_name,
        flutterwave_virtual_account_created_at: new Date().toISOString(),
        flutterwave_account_is_permanent: false, // Dynamic account (temporary) - will upgrade to static with BVN
        flutterwave_kyc_tier: 1, // Start with Tier 1 (no BVN) - can upgrade to Tier 2/3 with BVN
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[Flutterwave Add Phone] Error updating users:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to save virtual account" },
        { status: 500 }
      );
    }

    console.log(`[Flutterwave Add Phone] ✅ SUCCESS - Account ${vaData.account_number} assigned to ${userData.email} (${normalizedPhone})`);

    return NextResponse.json({
      success: true,
      message: "Phone number added and NGN account created successfully",
      data: {
        accountNumber: vaData.account_number,
        bankName: vaData.bank_name,
        accountName: vaData.account_name,
        mobileNumber: normalizedPhone,
        displayAccountNumber: normalizedPhone.substring(1), // Remove leading 0 for display
        isPermanent: false, // Dynamic account (temporary) - verify BVN to upgrade to static
        kycTier: 1, // Tier 1 - can upgrade with BVN verification
      },
    });
  } catch (error: any) {
    console.error("[Flutterwave Add Phone] Error:", error.response?.data || error.message);

    // Safely extract error message
    let errorMessage = "Failed to add phone number and create NGN account";
    if (error.response?.data?.message) {
      errorMessage = typeof error.response.data.message === 'string' 
        ? error.response.data.message 
        : String(error.response.data.message);
    } else if (error.message) {
      errorMessage = typeof error.message === 'string' 
        ? error.message 
        : String(error.message);
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: error.response?.data || error.message,
      },
      { status: 500 }
    );
  }
}
