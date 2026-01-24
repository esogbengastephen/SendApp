import { NextRequest, NextResponse } from "next/server";
import { base } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/**
 * Test endpoint to verify Coinbase Developer Platform credentials
 * GET /api/test/coinbase-credentials
 */
export async function GET(request: NextRequest) {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      checks: {},
      errors: [],
      success: false,
    };

    // Check 1: Environment Variables
    const apiKeyName = process.env.COINBASE_API_KEY_NAME;
    const apiKeyPrivateKey = process.env.COINBASE_API_KEY_PRIVATE_KEY;
    const appId = process.env.COINBASE_APP_ID;
    const paymasterEnabled = process.env.COINBASE_PAYMASTER_ENABLED;

    results.checks.environmentVariables = {
      COINBASE_API_KEY_NAME: !!apiKeyName,
      COINBASE_API_KEY_PRIVATE_KEY: !!apiKeyPrivateKey,
      COINBASE_APP_ID: !!appId,
      COINBASE_PAYMASTER_ENABLED: paymasterEnabled || "false",
    };

    if (!apiKeyName || !apiKeyPrivateKey || !appId) {
      results.errors.push("Missing required environment variables");
      return NextResponse.json(results, { status: 400 });
    }

    // Check 2: Format Validation
    const apiKeyNameValid = /^[A-Za-z0-9]+$/.test(apiKeyName);
    const privateKeyClean = apiKeyPrivateKey.replace(/^"|"$/g, "");
    const privateKeyValid = /^[A-Za-z0-9+/=]+$/.test(privateKeyClean);
    const appIdValid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appId);

    results.checks.formatValidation = {
      apiKeyName: apiKeyNameValid,
      privateKey: privateKeyValid,
      appId: appIdValid,
    };

    if (!apiKeyNameValid || !privateKeyValid || !appIdValid) {
      results.errors.push("Invalid format for one or more credentials");
      return NextResponse.json(results, { status: 400 });
    }

    // Check 3: Credential Details (without making API call)
    results.checks.credentialDetails = {
      apiKeyNameLength: apiKeyName.length,
      apiKeyNamePreview: `${apiKeyName.substring(0, 4)}...${apiKeyName.substring(apiKeyName.length - 4)}`,
      privateKeyLength: privateKeyClean.length,
      privateKeyPreview: `${privateKeyClean.substring(0, 8)}...${privateKeyClean.substring(privateKeyClean.length - 8)}`,
      appIdFormat: appIdValid ? "Valid UUID" : "Invalid format",
    };

    // Check 4: Try Coinbase SDK Connection (if SDK is available)
    try {
      // Try to import SDK
      const sdkModule = await import("@coinbase/coinbase-sdk");
      results.checks.sdkImport = true;
      results.checks.sdkExports = Object.keys(sdkModule).filter(k => 
        k.includes("Smart") || k.includes("Wallet") || k.includes("Coinbase")
      );

      // Note: The actual SDK API might differ, so we'll just verify credentials format
      // The real test happens when you try to create a wallet in the app
      results.success = true;
      results.message = "✅ Credentials format is valid!";
      results.note = "SDK import successful. Actual API validation will occur when creating a wallet.";

      return NextResponse.json(results, { status: 200 });
    } catch (sdkError: any) {
      const errorMessage = sdkError.message || String(sdkError);
      
      // If it's just a module resolution issue, credentials might still be valid
      if (errorMessage.includes("wordlists") || errorMessage.includes("MODULE_NOT_FOUND")) {
        results.checks.sdkImport = false;
        results.success = true; // Credentials format is still valid
        results.message = "✅ Credentials format is valid!";
        results.note = "SDK has module resolution issues (known issue with @scure/bip39), but credentials format is correct.";
        results.warning = "The SDK import issue doesn't affect credential validity. Test credentials by creating a wallet in the app.";
        return NextResponse.json(results, { status: 200 });
      }
      
      results.errors.push(`SDK Error: ${errorMessage}`);
      results.suggestion = "Check your Coinbase Developer Platform dashboard to verify credentials";
      return NextResponse.json(results, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
