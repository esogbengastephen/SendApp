import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createVirtualAccount, normalizeMobileNumber, isValidNigerianMobile } from "@/lib/flutterwave";

/**
 * Create Flutterwave virtual account during user signup
 * Creates a TEMPORARY account first (without BVN)
 * Will be upgraded to permanent after BVN verification
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, email, phoneNumber, firstName, lastName } = await request.json();

    console.log(`[Flutterwave Signup VA] Creating virtual account for user ${userId}`);

    if (!userId || !email) {
      return NextResponse.json(
        { success: false, error: "Missing userId or email" },
        { status: 400 }
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

    // Check if user already has a Flutterwave virtual account
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("flutterwave_virtual_account_number, mobile_number, is_blocked")
      .eq("id", userId)
      .single();

    if (userError && userError.code !== "PGRST116") {
      console.error("[Flutterwave Signup VA] Error fetching user:", userError);
      return NextResponse.json(
        { success: false, error: "Database error" },
        { status: 500 }
      );
    }

    if (userData?.is_blocked) {
      console.log(`[Flutterwave Signup VA] ❌ User ${userId} is blocked. Cannot create VA.`);
      return NextResponse.json(
        { 
          success: false, 
          error: "Your account has been blocked. Please contact support." 
        },
        { status: 403 }
      );
    }

    if (userData?.flutterwave_virtual_account_number) {
      console.log(`[Flutterwave Signup VA] User already has account: ${userData.flutterwave_virtual_account_number}`);
      return NextResponse.json({
        success: true,
        data: {
          accountNumber: userData.flutterwave_virtual_account_number,
          mobileNumber: userData.mobile_number,
          alreadyExists: true,
        },
      });
    }

    // Check if phone number is already in use
    const { data: existingUser } = await supabase
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
    console.log(`[Flutterwave Signup VA] Creating TEMPORARY Flutterwave virtual account for ${email} (${normalizedPhone})`);
    
    const vaResult = await createVirtualAccount({
      email,
      firstName: firstName || "User",
      lastName: lastName || "Account",
      phoneNumber: normalizedPhone,
      isPermanent: false, // Temporary account until BVN is verified
    });

    if (!vaResult.success) {
      console.error(`[Flutterwave Signup VA] Failed to create virtual account:`, vaResult.error);
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
    console.log(`[Flutterwave Signup VA] ✅ Virtual account created: ${vaData.account_number} (${vaData.bank_name})`);

    // Store virtual account and mobile number in database
    const { error: updateError } = await supabase
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
      console.error("[Flutterwave Signup VA] Error updating users:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to save virtual account" },
        { status: 500 }
      );
    }

    console.log(`[Flutterwave Signup VA] ✅ SUCCESS - Account ${vaData.account_number} assigned to ${email} (${normalizedPhone})`);

    return NextResponse.json({
      success: true,
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
    console.error("[Flutterwave Signup VA] Error:", error.response?.data || error.message);
    
    return NextResponse.json(
      {
        success: false,
        error: error.response?.data?.message || "Failed to create Flutterwave virtual account",
        details: error.response?.data || error.message,
      },
      { status: 500 }
    );
  }
}
