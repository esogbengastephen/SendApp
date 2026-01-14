import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserFromStorage } from "@/lib/session";

/**
 * Upgrade Flutterwave account to Tier 3 (Enhanced KYC)
 * This requires additional documentation submission
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      nin, // National Identification Number
      documentType, // e.g., "national_id", "passport", "drivers_license"
      documentNumber,
      documentUrl, // URL to uploaded document
      addressProofUrl, // URL to address proof document
    } = body;

    // Get current user from session
    const user = getUserFromStorage();
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's current account info
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email, flutterwave_kyc_tier, flutterwave_account_is_permanent, flutterwave_bvn")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Check if user is already at Tier 3
    if (userData.flutterwave_kyc_tier === 3) {
      return NextResponse.json({
        success: true,
        message: "Account is already at Tier 3",
        data: {
          kycTier: 3,
        },
      });
    }

    // Check if user is at Tier 2 (required for Tier 3 upgrade)
    if (userData.flutterwave_kyc_tier !== 2) {
      return NextResponse.json(
        { 
          success: false, 
          error: "You must be at Tier 2 (BVN verified) before upgrading to Tier 3. Please verify your BVN first." 
        },
        { status: 400 }
      );
    }

    // Validate required fields for Tier 3
    if (!nin && !documentNumber) {
      return NextResponse.json(
        { success: false, error: "NIN or document number is required for Tier 3 upgrade" },
        { status: 400 }
      );
    }

    if (!documentUrl) {
      return NextResponse.json(
        { success: false, error: "Document URL is required for Tier 3 upgrade" },
        { status: 400 }
      );
    }

    // TODO: In production, you would:
    // 1. Verify the documents with Flutterwave API or a KYC provider
    // 2. Store document URLs securely
    // 3. Update Flutterwave account with enhanced KYC information
    // 4. Wait for verification approval before upgrading tier

    // For now, we'll update the tier directly
    // In production, you might want to set a "pending" status first
    console.log(`[Flutterwave KYC] Upgrading user ${user.id} to Tier 3`);

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        flutterwave_kyc_tier: 3,
        flutterwave_nin: nin || null, // Store NIN if provided
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("[Flutterwave KYC] Error updating user:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to upgrade account" },
        { status: 500 }
      );
    }

    console.log(`[Flutterwave KYC] ✅ Account upgraded to Tier 3 for user ${user.id}`);

    return NextResponse.json({
      success: true,
      message: "Account upgraded to Tier 3 (Enhanced KYC)",
      data: {
        kycTier: 3,
        // In production, you might return verification status
        verificationStatus: "approved", // or "pending" if verification is async
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
