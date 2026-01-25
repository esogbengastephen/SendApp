import axios from "axios";

/**
 * Flutterwave v4 API Token Manager
 * Handles OAuth2 client credentials flow for v4 API
 * Based on: https://developer.flutterwave.com/docs/environments
 */

const FLW_CLIENT_ID = process.env.FLW_CLIENT_ID || process.env.FLUTTERWAVE_CLIENT_ID;
const FLW_CLIENT_SECRET = process.env.FLW_CLIENT_SECRET || process.env.FLUTTERWAVE_CLIENT_SECRET;
const FLUTTERWAVE_USE_TEST_MODE = process.env.FLUTTERWAVE_USE_TEST_MODE !== undefined
  ? process.env.FLUTTERWAVE_USE_TEST_MODE === "true"
  : process.env.NODE_ENV === "development";

// Token cache
interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

/**
 * Get access token using OAuth2 client credentials flow
 * Tokens are cached and automatically refreshed when expired
 */
export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 minute buffer)
  if (tokenCache && tokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
    return tokenCache.accessToken;
  }

  if (!FLW_CLIENT_ID || !FLW_CLIENT_SECRET) {
    throw new Error("Flutterwave v4 credentials not configured. Set FLW_CLIENT_ID and FLW_CLIENT_SECRET.");
  }

  try {
    console.log(`[Flutterwave v4] Requesting access token (${FLUTTERWAVE_USE_TEST_MODE ? 'TEST' : 'PRODUCTION'})`);

    const response = await axios.post(
      "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token",
      new URLSearchParams({
        client_id: FLW_CLIENT_ID,
        client_secret: FLW_CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (response.data.access_token) {
      const expiresIn = response.data.expires_in || 3600; // Default 1 hour
      tokenCache = {
        accessToken: response.data.access_token,
        expiresAt: Date.now() + (expiresIn * 1000),
      };

      console.log(`[Flutterwave v4] ✅ Access token obtained, expires in ${expiresIn}s`);
      return tokenCache.accessToken;
    }

    throw new Error("No access token in response");
  } catch (error: any) {
    const errorDetails = error.response?.data || {};
    const errorMessage = errorDetails.error_description || errorDetails.error || error.message;
    
    console.error("[Flutterwave v4] Token request error:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      error: errorDetails.error,
      errorDescription: errorDetails.error_description,
      hasClientId: !!FLW_CLIENT_ID,
      clientIdLength: FLW_CLIENT_ID?.length || 0,
      hasClientSecret: !!FLW_CLIENT_SECRET,
      clientSecretLength: FLW_CLIENT_SECRET?.length || 0,
      testMode: FLUTTERWAVE_USE_TEST_MODE,
    });
    
    // Provide more helpful error messages
    if (error.response?.status === 401) {
      throw new Error(`Flutterwave v4 authentication failed: Invalid client credentials. Please verify FLW_CLIENT_ID and FLW_CLIENT_SECRET are correct and match (both Live or both Test).`);
    }
    
    throw new Error(`Failed to get Flutterwave v4 access token: ${errorMessage}`);
  }
}

/**
 * Clear token cache (useful for testing or when credentials change)
 */
export function clearTokenCache(): void {
  tokenCache = null;
}

/**
 * Check if v4 credentials are configured
 */
export function isV4Configured(): boolean {
  return !!(FLW_CLIENT_ID && FLW_CLIENT_SECRET);
}
