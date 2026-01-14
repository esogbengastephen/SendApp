import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { createVirtualAccount, normalizeMobileNumber } from "@/lib/flutterwave";
import { getUserFromStorage } from "@/lib/session";

/**
 * Verify BVN and upgrade Flutterwave account to permanent
 * This is called after user completes KYC in the app
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bvn, firstName, lastName } = body;

    // Get current user from session
    const user = getUserFromStorage();
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!bvn) {
      return NextResponse.json(
        { success: false, error: "BVN is required" },
        { status: 400 }
      );
    }

    // Validate BVN format (11 digits)
    const cleanedBVN = bvn.replace(/\D/g, "");
    if (cleanedBVN.length !== 11) {
      return NextResponse.json(
        { success: false, error: "Invalid BVN format. BVN must be 11 digits" },
        { status: 400 }
      );
    }

    // Get user's current account info
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email, mobile_number, flutterwave_virtual_account_number, flutterwave_account_is_permanent")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    if (userData.flutterwave_account_is_permanent) {
      return NextResponse.json({
        success: true,
        message: "Account is already permanent",
        data: {
          accountNumber: userData.flutterwave_virtual_account_number,
          isPermanent: true,
        },
      });
    }

    if (!userData.mobile_number) {
      return NextResponse.json(
        { success: false, error: "Mobile number not found. Please contact support." },
        { status: 400 }
      );
    }

    // Create new permanent virtual account with BVN
    console.log(`[Flutterwave KYC] Creating permanent account for user ${user.id} with BVN`);

    const vaResult = await createVirtualAccount({
      email: userData.email,
      firstName: firstName || "User",
      lastName: lastName || "Account",
      phoneNumber: userData.mobile_number,
      bvn: cleanedBVN,
      isPermanent: true,
    });

    if (!vaResult.success) {
      console.error(`[Flutterwave KYC] Failed to create permanent account:`, vaResult.error);
      return NextResponse.json(
        { 
          success: false, 
          error: vaResult.error || "Failed to create permanent account",
          details: vaResult.details,
        },
        { status: 500 }
      );
    }

    const vaData = vaResult.data!;
    console.log(`[Flutterwave KYC] ✅ Permanent account created: ${vaData.account_number}`);

    // Update user with new permanent account, BVN, and upgrade to Tier 2
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        flutterwave_virtual_account_number: vaData.account_number,
        flutterwave_virtual_account_bank: vaData.bank_name,
        flutterwave_virtual_account_name: vaData.account_name,
        flutterwave_account_is_permanent: true,
        flutterwave_bvn: cleanedBVN, // Store BVN (encrypted in production)
        flutterwave_kyc_tier: 2, // Upgrade to Tier 2 after BVN verification
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("[Flutterwave KYC] Error updating user:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update account" },
        { status: 500 }
      );
    }

    console.log(`[Flutterwave KYC] ✅ Account upgraded to permanent for user ${user.id}`);

    return NextResponse.json({
      success: true,
      message: "BVN verified and account upgraded to permanent (Tier 2)",
      data: {
        accountNumber: vaData.account_number,
        bankName: vaData.bank_name,
        accountName: vaData.account_name,
        isPermanent: true,
        kycTier: 2,
      },
    });
  } catch (error: any) {
    console.error("[Flutterwave KYC] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
