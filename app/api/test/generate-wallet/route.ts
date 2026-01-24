import { NextRequest, NextResponse } from "next/server";
import { generateSmartWalletForUser } from "@/lib/coinbase-smart-wallet";

/**
 * Test endpoint to generate a wallet using Coinbase credentials
 * GET /api/test/generate-wallet
 */
export async function GET(request: NextRequest) {
  try {
    // Check environment variables
    const apiKeyName = process.env.COINBASE_API_KEY_NAME;
    const apiKeyPrivateKey = process.env.COINBASE_API_KEY_PRIVATE_KEY;
    const appId = process.env.COINBASE_APP_ID;

    if (!apiKeyName || !apiKeyPrivateKey || !appId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing Coinbase credentials in environment variables",
          missing: {
            COINBASE_API_KEY_NAME: !apiKeyName,
            COINBASE_API_KEY_PRIVATE_KEY: !apiKeyPrivateKey,
            COINBASE_APP_ID: !appId,
          },
        },
        { status: 400 }
      );
    }

    console.log("[Test] Starting wallet generation with Coinbase credentials...");
    console.log("[Test] API Key Name:", apiKeyName.substring(0, 4) + "...");
    console.log("[Test] App ID:", appId);

    // Generate a test wallet using the same function as the app
    // Using a test user ID and email
    const testUserId = "test-user-" + Date.now();
    const testUserEmail = "test@example.com";

    try {
      const walletData = await generateSmartWalletForUser(testUserId, testUserEmail);

      console.log("[Test] ✅ Wallet generated successfully!");
      console.log("[Test] Address:", walletData.address);

      return NextResponse.json({
        success: true,
        walletAddress: walletData.address,
        ownerPrivateKey: walletData.ownerPrivateKey.substring(0, 10) + "... (hidden)",
        salt: walletData.salt,
        network: "base",
        message: "✅ Wallet generated successfully using your Coinbase credentials!",
        timestamp: new Date().toISOString(),
        credentials: {
          apiKeyName: apiKeyName.substring(0, 4) + "...",
          appId,
          status: "✅ Valid",
        },
      });
    } catch (walletError: any) {
      console.error("[Test] Wallet generation error:", walletError);
      
      const errorMessage = walletError.message || String(walletError);
      
      // Provide helpful error messages
      let suggestion = "Check your Coinbase Developer Platform dashboard";
      let errorType = "Unknown";
      
      if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
        suggestion = "API Key Name or Private Key is incorrect, or App ID doesn't match";
        errorType = "Authentication Error";
      } else if (errorMessage.includes("404") || errorMessage.includes("Not Found")) {
        suggestion = "App ID is incorrect or app doesn't exist in your Coinbase Developer Platform account";
        errorType = "Not Found Error";
      } else if (errorMessage.includes("403") || errorMessage.includes("Forbidden")) {
        suggestion = "API key doesn't have permission for this app, or App ID and API key don't match";
        errorType = "Permission Error";
      } else if (errorMessage.includes("network") || errorMessage.includes("chain")) {
        suggestion = "Check if Base network is enabled for your app in Coinbase Developer Platform";
        errorType = "Network Configuration Error";
      } else if (errorMessage.includes("not a constructor") || errorMessage.includes("is not a function")) {
        suggestion = "SDK version mismatch. The Coinbase SDK API might have changed.";
        errorType = "SDK API Error";
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          errorType,
          suggestion,
          details: {
            apiKeyName: apiKeyName.substring(0, 4) + "...",
            appId,
            network: "base",
          },
          troubleshooting: [
            "1. Verify your API Key Name matches exactly in Coinbase Developer Platform",
            "2. Verify your Private Key is correct (check for extra spaces or missing characters)",
            "3. Verify your App ID matches the app in your Coinbase Developer Platform dashboard",
            "4. Check that Base network is enabled for your app",
            "5. Ensure your API key has the necessary permissions",
          ],
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[Test] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error occurred",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
