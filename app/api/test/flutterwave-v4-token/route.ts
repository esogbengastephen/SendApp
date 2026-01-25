import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

/**
 * Test endpoint to debug Flutterwave v4 OAuth2 token request
 * GET /api/test/flutterwave-v4-token
 */
export async function GET(request: NextRequest) {
  const FLW_CLIENT_ID = process.env.FLW_CLIENT_ID || process.env.FLUTTERWAVE_CLIENT_ID;
  const FLW_CLIENT_SECRET = process.env.FLW_CLIENT_SECRET || process.env.FLUTTERWAVE_CLIENT_SECRET;

  const result: any = {
    timestamp: new Date().toISOString(),
    credentials: {
      hasClientId: !!FLW_CLIENT_ID,
      hasClientSecret: !!FLW_CLIENT_SECRET,
      clientIdPrefix: FLW_CLIENT_ID ? `${FLW_CLIENT_ID.substring(0, 20)}...` : "NOT SET",
      clientIdLength: FLW_CLIENT_ID?.length || 0,
      clientSecretLength: FLW_CLIENT_SECRET?.length || 0,
    },
  };

  if (!FLW_CLIENT_ID || !FLW_CLIENT_SECRET) {
    return NextResponse.json({
      ...result,
      success: false,
      error: "Credentials not set",
      message: "FLW_CLIENT_ID and FLW_CLIENT_SECRET must be set in environment variables",
    }, { status: 400 });
  }

  try {
    console.log("[Test v4 Token] Requesting OAuth2 token...");
    console.log("[Test v4 Token] Client ID:", FLW_CLIENT_ID.substring(0, 20) + "...");
    
    const requestBody = new URLSearchParams({
      client_id: FLW_CLIENT_ID,
      client_secret: FLW_CLIENT_SECRET,
      grant_type: "client_credentials",
    });

    const startTime = Date.now();
    const response = await axios.post(
      "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token",
      requestBody,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        validateStatus: () => true, // Don't throw on any status
      }
    );
    const endTime = Date.now();

    result.request = {
      endpoint: "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token",
      method: "POST",
      contentType: "application/x-www-form-urlencoded",
    };

    result.response = {
      status: response.status,
      statusText: response.statusText,
      responseTime: `${endTime - startTime}ms`,
      data: response.data,
    };

    if (response.status === 200) {
      result.success = true;
      result.token = {
        accessToken: response.data.access_token ? `${response.data.access_token.substring(0, 30)}...` : null,
        tokenType: response.data.token_type,
        expiresIn: response.data.expires_in,
        scope: response.data.scope,
        fullTokenLength: response.data.access_token?.length || 0,
      };
      result.message = "✅ OAuth2 token obtained successfully";
      
      console.log("[Test v4 Token] ✅ Success! Token obtained");
    } else {
      result.success = false;
      result.error = {
        status: response.status,
        error: response.data.error,
        errorDescription: response.data.error_description,
        fullResponse: response.data,
      };

      if (response.status === 401) {
        result.message = "❌ Authentication failed: Invalid client credentials";
        result.recommendations = [
          "1. Verify FLW_CLIENT_ID and FLW_CLIENT_SECRET are correct in Vercel environment variables",
          "2. Ensure both credentials are from the same environment (both Live or both Test)",
          "3. Check that credentials are copied correctly (no extra spaces or characters)",
          "4. Verify credentials in Flutterwave Dashboard: https://dashboard.flutterwave.com/settings/api-keys",
        ];
      } else if (response.status === 400) {
        result.message = "❌ Bad request: Check request format";
        result.recommendations = [
          "1. Verify all required parameters are present",
          "2. Check Content-Type header is correct",
        ];
      } else {
        result.message = `❌ Unexpected error: ${response.status}`;
      }

      console.error("[Test v4 Token] ❌ Failed:", response.status, response.data);
    }

    return NextResponse.json(result, { 
      status: result.success ? 200 : 500 
    });
  } catch (error: any) {
    console.error("[Test v4 Token] Exception:", error);
    
    result.success = false;
    result.error = {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data,
    };

    if (error.response) {
      result.message = `❌ HTTP Error: ${error.response.status}`;
    } else if (error.request) {
      result.message = "❌ Network Error: No response received";
    } else {
      result.message = `❌ Error: ${error.message}`;
    }

    return NextResponse.json(result, { status: 500 });
  }
}
