import { NextRequest, NextResponse } from "next/server";
import { verifyBankAccount } from "@/lib/bank-verification";
import { isValidBankAccountNumber } from "@/lib/nigerian-banks";

/**
 * Verify bank account number and get account holder name
 * POST /api/flutterwave/verify-account
 * Body: { accountNumber: string, bankCode: string, bankName?: string }
 * bankName (e.g. "OPay") helps Paystack fallback resolve when Flutterwave fails.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountNumber, bankCode, bankName } = body;

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

    console.log(`[Verify Account API] Verifying account ${accountNumber} bank ${bankCode}${bankName ? ` (${bankName})` : ""}`);
    const result = await verifyBankAccount(accountNumber, bankCode, { bankName: bankName || undefined });
    console.log(`[Verify Account API] Result:`, JSON.stringify(result, null, 2));

    if (!result.success) {
      const rawError = result.error || "Account verification failed";
      const isConnectionError = /could not connect|connect to your bank|temporarily unavailable|connection/i.test(rawError);
      const error = isConnectionError
        ? "Bank verification is temporarily unavailable. Please check your account number and bank, then try again."
        : rawError;
      console.error(`[Verify Account API] Verification failed: ${rawError}`);
      return NextResponse.json(
        { success: false, error, details: result.details, isTestMode: result.isTestMode },
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
