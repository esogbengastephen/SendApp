import { NextRequest, NextResponse } from "next/server";
import { verifyBankAccount } from "@/lib/flutterwave";
import { isValidBankAccountNumber } from "@/lib/nigerian-banks";

/**
 * Verify bank account number and get account holder name
 * POST /api/flutterwave/verify-account
 * Body: { accountNumber: string, bankCode: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountNumber, bankCode } = body;

    if (!accountNumber || !bankCode) {
      return NextResponse.json(
        { success: false, error: "Account number and bank code are required" },
        { status: 400 }
      );
    }

    // Validate account number format
    if (!isValidBankAccountNumber(accountNumber)) {
      return NextResponse.json(
        { success: false, error: "Invalid account number format. Must be 10 digits." },
        { status: 400 }
      );
    }

    // Verify account with Flutterwave
    console.log(`[Verify Account API] Verifying account ${accountNumber} with bank code ${bankCode}`);
    const result = await verifyBankAccount(accountNumber, bankCode);
    console.log(`[Verify Account API] Result:`, JSON.stringify(result, null, 2));

    if (!result.success) {
      console.error(`[Verify Account API] Verification failed: ${result.error}`);
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || "Account verification failed",
          details: result.details,
          isTestMode: result.isTestMode,
        },
        { status: 400 }
      );
    }

    if (!result.data || !result.data.accountName) {
      console.error(`[Verify Account API] Missing account name in result:`, result);
      return NextResponse.json(
        { 
          success: false, 
          error: "Account verified but name not available",
          details: result,
        },
        { status: 400 }
      );
    }

    console.log(`[Verify Account API] Success - Account Name: ${result.data.accountName}`);
    return NextResponse.json({
      success: true,
      data: {
        accountNumber: result.data.accountNumber || accountNumber,
        accountName: result.data.accountName,
        verified: true,
      },
    });
  } catch (error: any) {
    console.error("[Flutterwave Verify Account] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
