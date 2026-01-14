import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    // Log initialization check
    if (!supabaseAdmin) {
      console.error("[Profile API] supabaseAdmin is not initialized");
      return NextResponse.json(
        { 
          success: false, 
          error: "Database connection not available",
          details: "Supabase admin client not initialized"
        },
        { status: 500 }
      );
    }
    // Get userId from query params (sent from client)
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId || userId.trim() === "") {
      console.error("[Profile API] Missing or empty userId");
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error("[Profile API] Invalid userId format:", userId);
      return NextResponse.json(
        { success: false, error: "Invalid user ID format" },
        { status: 400 }
      );
    }

    console.log("[Profile API] Fetching profile for userId:", userId);

    // Get user profile from database with all chain addresses (JSONB column)
    const { data: userData, error: fetchError } = await supabaseAdmin
      .from("users")
      .select(`
        id,
        email,
        display_name,
        photo_url,
        wallet_addresses,
        wallet_created_at,
        passkey_created_at,
        passkey_credential_id,
        mobile_number,
        flutterwave_virtual_account_number,
        flutterwave_virtual_account_bank,
        flutterwave_account_is_permanent,
        flutterwave_kyc_tier,
        invoice_type,
        business_name,
        business_logo_url,
        business_address,
        business_city,
        business_state,
        business_zip,
        business_phone
      `)
      .eq("id", userId)
      .single();

    console.log("[Profile API] Query result - hasData:", !!userData, "hasError:", !!fetchError);

    if (fetchError) {
      console.error("[Profile API] Database error:", fetchError);
      return NextResponse.json(
        { 
          success: false, 
          error: fetchError.message,
          code: fetchError.code 
        },
        { status: 500 }
      );
    }

    if (!userData) {
      console.error("[Profile API] User not found for userId:", userId);
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // wallet_addresses is already a JSON object from the database
    // Handle null, undefined, or empty object cases
    let addresses: Record<string, string> = {};
    if (userData.wallet_addresses) {
      if (typeof userData.wallet_addresses === 'object' && !Array.isArray(userData.wallet_addresses)) {
        addresses = userData.wallet_addresses as Record<string, string>;
      }
    }

    const profileData = {
      id: userData.id,
      email: userData.email,
      displayName: userData.display_name || null,
      photoUrl: userData.photo_url || null,
      addresses,
      hasWallet: Object.keys(addresses).length > 0,
      hasPasskey: !!userData.passkey_credential_id,
      walletCreatedAt: userData.wallet_created_at || null,
      passkeyCreatedAt: userData.passkey_created_at || null,
      mobileNumber: userData.mobile_number || null,
      flutterwaveAccountNumber: userData.flutterwave_virtual_account_number || null,
      flutterwaveBank: userData.flutterwave_virtual_account_bank || null,
      flutterwaveIsPermanent: userData.flutterwave_account_is_permanent || false,
      flutterwaveKYCTier: userData.flutterwave_kyc_tier || 1,
      invoiceType: userData.invoice_type || 'personal',
      businessName: userData.business_name || null,
      businessLogoUrl: userData.business_logo_url || null,
      businessAddress: userData.business_address || null,
      businessCity: userData.business_city || null,
      businessState: userData.business_state || null,
      businessZip: userData.business_zip || null,
      businessPhone: userData.business_phone || null,
    };

    console.log("[Profile API] Returning profile data for:", userData.email);

    const response = NextResponse.json({
      success: true,
      profile: profileData,
    });

    // Add caching headers (profile changes infrequently, cache for 5 minutes)
    response.headers.set('Cache-Control', 'private, s-maxage=300, stale-while-revalidate=600');
    
    return response;
  } catch (err: any) {
    console.error("[Profile API] Exception caught:", err);
    console.error("[Profile API] Error stack:", err.stack);
    console.error("[Profile API] Error name:", err.name);
    console.error("[Profile API] Error message:", err.message);
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Internal server error",
        message: err.message,
        name: err.name,
        details: process.env.NODE_ENV === "development" ? {
          message: err.message,
          stack: err.stack,
          name: err.name
        } : undefined
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { 
      userId, 
      display_name, 
      photo_url,
      invoice_type,
      business_name,
      business_logo_url,
      business_address,
      business_city,
      business_state,
      business_zip,
      business_phone
    } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    const updates: any = {};
    if (display_name !== undefined) updates.display_name = display_name;
    if (photo_url !== undefined) updates.photo_url = photo_url;
    if (invoice_type !== undefined) updates.invoice_type = invoice_type;
    if (business_name !== undefined) updates.business_name = business_name;
    if (business_logo_url !== undefined) updates.business_logo_url = business_logo_url;
    if (business_address !== undefined) updates.business_address = business_address;
    if (business_city !== undefined) updates.business_city = business_city;
    if (business_state !== undefined) updates.business_state = business_state;
    if (business_zip !== undefined) updates.business_zip = business_zip;
    if (business_phone !== undefined) updates.business_phone = business_phone;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    // Update user profile
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: updatedUser.id,
        email: updatedUser.email,
        displayName: updatedUser.display_name,
        photoUrl: updatedUser.photo_url,
        invoiceType: updatedUser.invoice_type || 'personal',
        businessName: updatedUser.business_name,
        businessLogoUrl: updatedUser.business_logo_url,
        businessAddress: updatedUser.business_address,
        businessCity: updatedUser.business_city,
        businessState: updatedUser.business_state,
        businessZip: updatedUser.business_zip,
        businessPhone: updatedUser.business_phone,
      },
    });
  } catch (err: any) {
    console.error("Error updating profile:", err);
    return NextResponse.json(
      { 
        success: false, 
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? err.message : undefined
      },
      { status: 500 }
    );
  }
}

