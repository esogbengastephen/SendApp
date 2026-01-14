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

    // If user already has Flutterwave account, return it
    if (userData.flutterwave_virtual_account_number) {
      return NextResponse.json({
        success: true,
        message: "You already have a Flutterwave account",
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

    // Create TEMPORARY Flutterwave virtual account (without BVN)
    // Will be upgraded to permanent after BVN verification
    console.log(`[Flutterwave Add Phone] Creating TEMPORARY Flutterwave virtual account for existing user ${userData.email} (${normalizedPhone})`);

    const vaResult = await createVirtualAccount({
      email: userData.email,
      firstName: firstName || userData.display_name?.split(" ")[0] || "User",
      lastName: lastName || userData.display_name?.split(" ").slice(1).join(" ") || "Account",
      phoneNumber: normalizedPhone,
      isPermanent: false, // Temporary account until BVN is verified
    });

    if (!vaResult.success) {
      console.error(`[Flutterwave Add Phone] Failed to create virtual account:`, vaResult.error);
      console.error(`[Flutterwave Add Phone] Error details:`, vaResult.details);
      
      // Check if it's an authorization error
      const isAuthError = vaResult.error?.toLowerCase().includes("authorization") || 
                         vaResult.error?.toLowerCase().includes("invalid") ||
                         vaResult.details?.status === 401 ||
                         vaResult.details?.status === 403;
      
      if (isAuthError) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid Flutterwave API key. Please check your FLUTTERWAVE_SECRET_KEY environment variable.",
            details: {
              message: vaResult.error,
              hint: "Make sure you're using the correct secret key from your Flutterwave dashboard",
            },
          },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        {
          success: false,
          error: vaResult.error || "Failed to create Flutterwave virtual account",
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
        flutterwave_account_is_permanent: false, // Will be upgraded after BVN verification
        flutterwave_kyc_tier: 1, // Start with Tier 1 (no BVN)
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
      message: "Phone number added and Flutterwave account created successfully",
      data: {
        accountNumber: vaData.account_number,
        bankName: vaData.bank_name,
        accountName: vaData.account_name,
        mobileNumber: normalizedPhone,
        displayAccountNumber: normalizedPhone.substring(1), // Remove leading 0 for display
        isPermanent: false, // Temporary until BVN verified
      },
    });
  } catch (error: any) {
    console.error("[Flutterwave Add Phone] Error:", error.response?.data || error.message);

    return NextResponse.json(
      {
        success: false,
        error: error.response?.data?.message || "Failed to add phone number and create Flutterwave account",
        details: error.response?.data || error.message,
      },
      { status: 500 }
    );
  }
}
