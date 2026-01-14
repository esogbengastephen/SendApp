import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { normalizeMobileNumber, isValidNigerianMobile } from "@/lib/flutterwave";

/**
 * PUBLIC API: Look up user's Flutterwave virtual account by phone number
 * This allows anyone (inside or outside the app) to get account details for transfers
 * Used when someone wants to send money to a phone number
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phoneNumber = searchParams.get("phoneNumber");

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

    // Look up user by mobile number (PUBLIC - no auth required)
    const { data: user, error } = await supabase
      .from("users")
      .select("id, mobile_number, flutterwave_virtual_account_number, flutterwave_virtual_account_bank, flutterwave_virtual_account_name, flutterwave_account_is_permanent")
      .eq("mobile_number", normalizedPhone)
      .maybeSingle();

    if (error) {
      console.error("[Flutterwave Lookup] Error:", error);
      return NextResponse.json(
        { success: false, error: "Database error" },
        { status: 500 }
      );
    }

    if (!user || !user.flutterwave_virtual_account_number) {
      return NextResponse.json(
        { success: false, error: "Account not found for this phone number" },
        { status: 404 }
      );
    }

    // Return account details (public information)
    return NextResponse.json({
      success: true,
      data: {
        accountNumber: user.flutterwave_virtual_account_number,
        bankName: user.flutterwave_virtual_account_bank,
        accountName: user.flutterwave_virtual_account_name,
        mobileNumber: user.mobile_number,
        displayAccountNumber: user.mobile_number?.substring(1), // Remove leading 0 for display
        isPermanent: user.flutterwave_account_is_permanent || false,
      },
    });
  } catch (error: any) {
    console.error("[Flutterwave Lookup] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
