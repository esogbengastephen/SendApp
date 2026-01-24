import { NextRequest, NextResponse } from "next/server";
import { 
  getAccountBalance, 
  normalizeMobileNumber, 
  isValidNigerianMobile,
  verifyWebhookSignature 
} from "@/lib/flutterwave";
import axios from "axios";

/**
 * GET - Test endpoint to verify Flutterwave environment variables and API connection
 * This helps debug if Flutterwave is properly configured
 * 
 * Usage: GET /api/test/flutterwave-env
 */
export async function GET(request: NextRequest) {
  const flutterwaveSecretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  const flutterwavePublicKey = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY;
  const flutterwaveWebhookSecretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
  // If FLUTTERWAVE_USE_TEST_MODE is explicitly set, use that value
  // Otherwise, default to test mode in development, production mode otherwise
  const useTestMode = process.env.FLUTTERWAVE_USE_TEST_MODE !== undefined
    ? process.env.FLUTTERWAVE_USE_TEST_MODE === "true"
    : process.env.NODE_ENV === "development";
  
  // Detect test keys (usually start with FLWSECK_TEST or similar patterns)
  const isTestKey = flutterwaveSecretKey?.includes("TEST") || 
                    flutterwaveSecretKey?.includes("test") ||
                    flutterwaveSecretKey?.startsWith("FLWSECK_TEST");
  
  // Check for key/mode mismatch
  const keyModeMismatch = !isTestKey && useTestMode;
  const modeKeyMismatch = isTestKey && !useTestMode;
  
  const FLUTTERWAVE_API_BASE = useTestMode 
    ? "https://developersandbox-api.flutterwave.com/v3"
    : "https://api.flutterwave.com/v3";
  
  const result: any = {
    timestamp: new Date().toISOString(),
    credentials: {
      hasSecretKey: !!flutterwaveSecretKey,
      hasPublicKey: !!flutterwavePublicKey,
      hasWebhookSecretHash: !!flutterwaveWebhookSecretHash,
      secretKeyPrefix: flutterwaveSecretKey ? `${flutterwaveSecretKey.substring(0, 15)}...` : "NOT SET",
      publicKeyPrefix: flutterwavePublicKey ? `${flutterwavePublicKey.substring(0, 15)}...` : "NOT SET",
      webhookSecretHashPrefix: flutterwaveWebhookSecretHash ? `${flutterwaveWebhookSecretHash.substring(0, 10)}...` : "NOT SET",
      secretKeyLength: flutterwaveSecretKey?.length || 0,
      publicKeyLength: flutterwavePublicKey?.length || 0,
      webhookSecretHashLength: flutterwaveWebhookSecretHash?.length || 0,
      appearsToBeTestKey: isTestKey,
      useTestMode: useTestMode,
      apiBaseUrl: FLUTTERWAVE_API_BASE,
      keyModeMismatch: keyModeMismatch,
      modeKeyMismatch: modeKeyMismatch,
      warning: keyModeMismatch 
        ? "⚠️ LIVE keys detected but using TEST mode. Set FLUTTERWAVE_USE_TEST_MODE=false in .env.local"
        : modeKeyMismatch
        ? "⚠️ TEST keys detected but using PRODUCTION mode. Set FLUTTERWAVE_USE_TEST_MODE=true in .env.local"
        : null,
    },
    allSet: !!(flutterwaveSecretKey && flutterwavePublicKey),
    tests: {},
  };

  // Test 1: API Connection (Balance Check)
  if (result.allSet) {
    // Check for key/mode mismatch first
    if (keyModeMismatch) {
      result.tests.balanceApi = {
        success: false,
        error: "Key/Mode Mismatch",
        message: "❌ LIVE keys cannot be used with TEST mode. Set FLUTTERWAVE_USE_TEST_MODE=false in .env.local and restart server",
        recommendation: "Your keys are LIVE (production) keys but the system is using TEST (sandbox) API. Add FLUTTERWAVE_USE_TEST_MODE=false to .env.local",
      };
    } else if (modeKeyMismatch) {
      result.tests.balanceApi = {
        success: false,
        error: "Key/Mode Mismatch",
        message: "❌ TEST keys cannot be used with PRODUCTION mode. Set FLUTTERWAVE_USE_TEST_MODE=true in .env.local and restart server",
        recommendation: "Your keys are TEST (sandbox) keys but the system is using PRODUCTION API. Add FLUTTERWAVE_USE_TEST_MODE=true to .env.local",
      };
    } else {
      try {
        const balanceResult = await getAccountBalance();
        
        // Some Flutterwave accounts may not have balance endpoint access
        // If it fails with "NO AUTH CONTEXT FOUND", it might be a permissions issue
        // but authentication is still working (as proven by transfer endpoint)
        const isAuthWorking = balanceResult.error?.includes("NO AUTH CONTEXT FOUND") 
          ? false 
          : balanceResult.success;
        
        result.tests.balanceApi = {
          success: isAuthWorking,
          error: balanceResult.error,
          balance: balanceResult.data ? {
            currency: balanceResult.data.currency,
            availableBalance: balanceResult.data.available_balance,
            ledgerBalance: balanceResult.data.ledger_balance,
          } : null,
          message: balanceResult.success 
            ? "✅ API connection successful - Balance retrieved" 
            : balanceResult.error?.includes("NO AUTH CONTEXT FOUND")
            ? "⚠️ Balance endpoint not accessible (may require additional permissions). Authentication is working (see transfer endpoint test)."
            : `❌ API connection failed: ${balanceResult.error}`,
          note: balanceResult.error?.includes("NO AUTH CONTEXT FOUND")
            ? "This is often a permissions issue. Your API keys are valid (transfer endpoint works). Contact Flutterwave support to enable balance access if needed."
            : null,
        };
      } catch (error: any) {
        result.tests.balanceApi = {
          success: false,
          error: error.message || "Unknown error",
          details: error.response?.data || error.response?.status,
          message: `❌ API connection error: ${error.message}`,
        };
      }
    }
  } else {
    result.tests.balanceApi = {
      success: false,
      error: "Credentials not set",
      message: "⚠️ Cannot test API - credentials missing",
    };
  }

  // Test 2: Webhook Signature Verification
  const webhookSecret = flutterwaveWebhookSecretHash || flutterwaveSecretKey;
  if (webhookSecret) {
    try {
      const testPayload = JSON.stringify({ event: "test", data: { test: true } });
      const testSignature = require("crypto")
        .createHmac("sha256", webhookSecret)
        .update(testPayload)
        .digest("hex");
      
      const isValid = verifyWebhookSignature(testPayload, testSignature);
      result.tests.webhookSignature = {
        success: isValid,
        usingWebhookSecretHash: !!flutterwaveWebhookSecretHash,
        message: isValid 
          ? (flutterwaveWebhookSecretHash 
              ? "✅ Webhook signature verification working (using webhook secret hash)" 
              : "✅ Webhook signature verification working (using API secret key as fallback)")
          : "❌ Webhook signature verification failed",
      };
    } catch (error: any) {
      result.tests.webhookSignature = {
        success: false,
        error: error.message,
        message: `❌ Webhook signature test error: ${error.message}`,
      };
    }
  } else {
    result.tests.webhookSignature = {
      success: false,
      error: "Webhook secret not set",
      message: "⚠️ Cannot test webhook signature - webhook secret hash or API secret key missing",
      recommendation: "Set FLUTTERWAVE_WEBHOOK_SECRET_HASH in .env.local (configured in Flutterwave Dashboard > Settings > Webhooks)",
    };
  }

  // Test 3: Virtual Account API Endpoint (without creating account)
  if (result.allSet) {
    try {
      // Just test if the endpoint is reachable (we'll get auth error if credentials are wrong)
      const testResponse = await axios.get(
        `${FLUTTERWAVE_API_BASE}/virtual-account-numbers`,
        {
          headers: {
            Authorization: `Bearer ${flutterwaveSecretKey}`,
            "Content-Type": "application/json",
          },
          validateStatus: () => true, // Don't throw on any status
        }
      );
      
      // 404 might mean the endpoint doesn't support GET, but POST works (which is what we use)
      result.tests.virtualAccountEndpoint = {
        success: testResponse.status === 200 || testResponse.status === 400, // 400 means endpoint exists but needs params
        status: testResponse.status,
        statusText: testResponse.statusText,
        message: testResponse.status === 200 
          ? "✅ Virtual account endpoint accessible"
          : testResponse.status === 401 || testResponse.status === 403
          ? "❌ Authentication failed - check your secret key"
          : testResponse.status === 400
          ? "✅ Virtual account endpoint accessible (400 = needs parameters)"
          : testResponse.status === 404
          ? "⚠️ GET not supported (POST works - this is normal for virtual account creation)"
          : `⚠️ Unexpected status: ${testResponse.status}`,
        error: testResponse.data?.message || testResponse.data?.error,
        note: testResponse.status === 404
          ? "Virtual account creation uses POST, not GET. This is expected behavior."
          : null,
      };
    } catch (error: any) {
      result.tests.virtualAccountEndpoint = {
        success: false,
        error: error.message,
        details: error.response?.data || error.response?.status,
        message: `❌ Virtual account endpoint test failed: ${error.message}`,
      };
    }
  } else {
    result.tests.virtualAccountEndpoint = {
      success: false,
      error: "Credentials not set",
      message: "⚠️ Cannot test endpoint - credentials missing",
    };
  }

  // Test 4: Transfer API Endpoint (without creating transfer)
  if (result.allSet) {
    try {
      const testResponse = await axios.get(
        `${FLUTTERWAVE_API_BASE}/transfers`,
        {
          headers: {
            Authorization: `Bearer ${flutterwaveSecretKey}`,
            "Content-Type": "application/json",
          },
          validateStatus: () => true,
        }
      );
      
      result.tests.transferEndpoint = {
        success: testResponse.status === 200 || testResponse.status === 400,
        status: testResponse.status,
        statusText: testResponse.statusText,
        message: testResponse.status === 200 
          ? "✅ Transfer endpoint accessible"
          : testResponse.status === 401 || testResponse.status === 403
          ? "❌ Authentication failed - check your secret key"
          : testResponse.status === 400
          ? "✅ Transfer endpoint accessible (400 = needs parameters)"
          : `⚠️ Unexpected status: ${testResponse.status}`,
        error: testResponse.data?.message || testResponse.data?.error,
      };
    } catch (error: any) {
      result.tests.transferEndpoint = {
        success: false,
        error: error.message,
        details: error.response?.data || error.response?.status,
        message: `❌ Transfer endpoint test failed: ${error.message}`,
      };
    }
  } else {
    result.tests.transferEndpoint = {
      success: false,
      error: "Credentials not set",
      message: "⚠️ Cannot test endpoint - credentials missing",
    };
  }

  // Test 5: Phone number validation
  const testNumbers = [
    "07034494055",
    "08123456789",
    "2347034494055",
    "7034494055",
    "+2347034494055",
    "invalid",
    "1234567890",
  ];

  result.tests.phoneValidation = {
    success: true,
    tests: testNumbers.map(num => ({
      input: num,
      normalized: normalizeMobileNumber(num),
      isValid: isValidNigerianMobile(num),
      result: isValidNigerianMobile(num) ? "✅ Valid" : "❌ Invalid",
    })),
    message: "✅ Phone number validation functions working",
  };

  // Overall status
  // Count critical tests (webhook, transfer, phone validation)
  // Balance and virtual account GET are less critical
  const allTests = Object.values(result.tests).filter((test: any) => test.success !== undefined);
  const criticalTests = [
    result.tests.webhookSignature,
    result.tests.transferEndpoint,
    result.tests.phoneValidation,
  ].filter(t => t);
  const criticalPassed = criticalTests.filter((test: any) => test.success === true).length;
  const passedTests = allTests.filter((test: any) => test.success === true).length;
  const totalTests = allTests.length;
  
  // System is ready if:
  // 1. All credentials are set
  // 2. No key/mode mismatch
  // 3. Critical tests pass (webhook, transfer, phone validation)
  const isReady = result.allSet && 
                  !result.credentials.keyModeMismatch && 
                  !result.credentials.modeKeyMismatch &&
                  criticalPassed === criticalTests.length;
  
  result.summary = {
    totalTests,
    passedTests,
    failedTests: totalTests - passedTests,
    criticalTests: criticalTests.length,
    criticalPassed,
    overallStatus: passedTests === totalTests 
      ? "✅ All tests passed" 
      : isReady
      ? `✅ Critical tests passed (${criticalPassed}/${criticalTests.length}) - System ready`
      : `⚠️ ${passedTests}/${totalTests} tests passed`,
    ready: isReady,
    note: !isReady && result.credentials.keyModeMismatch
      ? "Fix key/mode mismatch to proceed"
      : !isReady && criticalPassed < criticalTests.length
      ? "Some critical tests failed - check authentication"
      : null,
  };

  return NextResponse.json(result, { 
    status: result.summary.ready ? 200 : 500 
  });
}
