import { NextRequest, NextResponse } from "next/server";
import { getAccountBalance, normalizeMobileNumber, isValidNigerianMobile } from "@/lib/flutterwave";

/**
 * GET - Test endpoint to verify Flutterwave environment variables and API connection
 * This helps debug if Flutterwave is properly configured
 */
export async function GET(request: NextRequest) {
  const flutterwaveSecretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  const flutterwavePublicKey = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY;
  const useTestMode = process.env.FLUTTERWAVE_USE_TEST_MODE === "true" || process.env.NODE_ENV === "development";
  
  // Detect test keys (usually start with FLWSECK_TEST or similar patterns)
  const isTestKey = flutterwaveSecretKey?.includes("TEST") || 
                    flutterwaveSecretKey?.includes("test") ||
                    flutterwaveSecretKey?.startsWith("FLWSECK_TEST");
  
  const result: any = {
    credentials: {
      hasSecretKey: !!flutterwaveSecretKey,
      hasPublicKey: !!flutterwavePublicKey,
      secretKeyPrefix: flutterwaveSecretKey ? `${flutterwaveSecretKey.substring(0, 10)}...` : "NOT SET",
      publicKeyPrefix: flutterwavePublicKey ? `${flutterwavePublicKey.substring(0, 10)}...` : "NOT SET",
      appearsToBeTestKey: isTestKey,
      useTestMode: useTestMode,
      apiBaseUrl: useTestMode 
        ? "https://developersandbox-api.flutterwave.com/v3"
        : "https://api.flutterwave.com/v3",
    },
    allSet: !!(flutterwaveSecretKey && flutterwavePublicKey),
  };

  // Test API connection if keys are set
  if (result.allSet) {
    try {
      const balanceResult = await getAccountBalance();
      result.apiConnection = {
        success: balanceResult.success,
        error: balanceResult.error,
        balance: balanceResult.data ? {
          currency: balanceResult.data.currency,
          availableBalance: balanceResult.data.available_balance,
          ledgerBalance: balanceResult.data.ledger_balance,
        } : null,
      };
    } catch (error: any) {
      result.apiConnection = {
        success: false,
        error: error.message,
      };
    }
  }

  // Test phone number validation
  const testNumbers = [
    "07034494055",
    "08123456789",
    "2347034494055",
    "7034494055",
    "invalid",
  ];

  result.phoneValidation = testNumbers.map(num => ({
    input: num,
    normalized: normalizeMobileNumber(num),
    isValid: isValidNigerianMobile(num),
  }));

  return NextResponse.json(result);
}
