import axios from "axios";
import { getAccessToken, isV4Configured } from "./flutterwave-v4-token";

// Flutterwave v4 API credentials (OAuth2)
const FLW_CLIENT_ID = process.env.FLW_CLIENT_ID || process.env.FLUTTERWAVE_CLIENT_ID;
const FLW_CLIENT_SECRET = process.env.FLW_CLIENT_SECRET || process.env.FLUTTERWAVE_CLIENT_SECRET;

// Flutterwave v3 API credentials (legacy - for backward compatibility)
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;
const FLUTTERWAVE_PUBLIC_KEY = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY;

const FLUTTERWAVE_WEBHOOK_SECRET_HASH = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;

// If FLUTTERWAVE_USE_TEST_MODE is explicitly set, use that value
// Otherwise, default to test mode in development, production mode otherwise
const FLUTTERWAVE_USE_TEST_MODE = process.env.FLUTTERWAVE_USE_TEST_MODE !== undefined
  ? process.env.FLUTTERWAVE_USE_TEST_MODE === "true"
  : process.env.NODE_ENV === "development";

// Determine which API version to use
// IMPORTANT: v4 API is NOT available in test/sandbox environment
// - Test mode: Always use v3 API (even if v4 credentials are set)
// - Production mode: Use v4 if credentials available AND not forced to v3, otherwise v3
// Force v3 by setting FLUTTERWAVE_FORCE_V3=true (useful if v4 credentials are invalid)
const FORCE_V3 = process.env.FLUTTERWAVE_FORCE_V3 === "true";
const USE_V4_API = !FLUTTERWAVE_USE_TEST_MODE && isV4Configured() && !FORCE_V3;

// API Base URLs
// v4 API: https://f4bexperience.flutterwave.com/ (production) or https://developersandbox-api.flutterwave.com/ (test)
// v3 API: https://api.flutterwave.com/v3 (production) or https://developersandbox-api.flutterwave.com/v3 (test)
const FLUTTERWAVE_API_BASE = USE_V4_API
  ? (FLUTTERWAVE_USE_TEST_MODE 
      ? "https://developersandbox-api.flutterwave.com"
      : "https://f4bexperience.flutterwave.com")
  : (FLUTTERWAVE_USE_TEST_MODE 
      ? "https://developersandbox-api.flutterwave.com/v3"
      : "https://api.flutterwave.com/v3");

if (USE_V4_API) {
  console.log(`[Flutterwave] Using v4 API (OAuth2) - PRODUCTION: ${FLUTTERWAVE_API_BASE}`);
} else {
  if (FLUTTERWAVE_USE_TEST_MODE) {
    console.log(`[Flutterwave] Using v3 API (Bearer Token) - TEST/SANDBOX: ${FLUTTERWAVE_API_BASE}`);
    if (isV4Configured()) {
      console.log(`[Flutterwave] Note: v4 credentials detected but v4 API is not available in test mode. Using v3 API with test keys.`);
    }
  } else {
    if (FORCE_V3) {
      console.log(`[Flutterwave] Using v3 API (Bearer Token) - PRODUCTION (forced): ${FLUTTERWAVE_API_BASE}`);
      if (isV4Configured()) {
        console.log(`[Flutterwave] Note: v4 credentials detected but FLUTTERWAVE_FORCE_V3=true. Using v3 API with live keys.`);
      }
    } else {
      if (!FLUTTERWAVE_SECRET_KEY && !isV4Configured()) {
        console.warn("FLUTTERWAVE_SECRET_KEY is not set. For v3 API, set FLUTTERWAVE_SECRET_KEY. For v4 API, set FLW_CLIENT_ID and FLW_CLIENT_SECRET.");
      }
      console.log(`[Flutterwave] Using v3 API (Bearer Token) - PRODUCTION: ${FLUTTERWAVE_API_BASE}`);
    }
  }
}

/**
 * Get authentication header for Flutterwave API requests
 * v4 uses OAuth2 access token, v3 uses secret key
 */
async function getAuthHeader(): Promise<string> {
  if (USE_V4_API) {
    const accessToken = await getAccessToken();
    return `Bearer ${accessToken}`;
  } else {
    if (!FLUTTERWAVE_SECRET_KEY) {
      throw new Error("Flutterwave credentials not configured. For v4, set FLW_CLIENT_ID and FLW_CLIENT_SECRET. For v3, set FLUTTERWAVE_SECRET_KEY.");
    }
    // Trim secret key to remove any whitespace
    const secretKey = FLUTTERWAVE_SECRET_KEY.trim();
    if (!secretKey) {
      throw new Error("Flutterwave secret key is empty after trimming. Check for whitespace issues.");
    }
    return `Bearer ${secretKey}`;
  }
}

/**
 * Convert mobile number to virtual account format (for display purposes)
 * Mobile: 07034494055 → Display: 7034494055 (remove leading 0)
 * Note: Flutterwave generates account numbers, but we use this for UI display
 */
export function mobileToVirtualAccountFormat(mobileNumber: string): string {
  const cleaned = mobileNumber.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    return cleaned.substring(1);
  }
  if (cleaned.startsWith("234")) {
    const withoutCountryCode = cleaned.substring(3);
    return withoutCountryCode.startsWith("0") ? withoutCountryCode.substring(1) : withoutCountryCode;
  }
  return cleaned;
}

/**
 * Convert virtual account format to mobile number
 * Format: 7034494055 → Mobile: 07034494055 (add leading 0)
 */
export function virtualAccountFormatToMobile(virtualAccount: string): string {
  const cleaned = virtualAccount.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    return cleaned;
  }
  return `0${cleaned}`;
}

/**
 * Validate Nigerian mobile number format
 * Accepts: 07034494055, 7034494055, 2347034494055, +2347034494055
 */
export function isValidNigerianMobile(mobileNumber: string): boolean {
  if (!mobileNumber || typeof mobileNumber !== "string") {
    return false;
  }
  
  const cleaned = mobileNumber.replace(/\D/g, "");
  
  // Must have 10-13 digits
  if (cleaned.length < 10 || cleaned.length > 13) {
    return false;
  }
  
  // Handle different formats
  let normalized: string;
  
  if (cleaned.startsWith("234") && cleaned.length === 13) {
    // International format: 2347034494055
    normalized = `0${cleaned.substring(3)}`;
  } else if (cleaned.length === 10) {
    // Without leading 0: 7034494055
    normalized = `0${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith("0")) {
    // Standard format: 07034494055
    normalized = cleaned;
  } else {
    return false;
  }
  
  // Check prefix (must be 07, 08, or 09)
  const prefix = normalized.substring(0, 2);
  return ["07", "08", "09"].includes(prefix);
}

/**
 * Normalize mobile number to standard format (07034494055)
 */
export function normalizeMobileNumber(mobileNumber: string): string {
  const cleaned = mobileNumber.replace(/\D/g, "");
  
  if (cleaned.startsWith("234") && cleaned.length === 13) {
    return `0${cleaned.substring(3)}`;
  }
  
  if (cleaned.length === 10) {
    return `0${cleaned}`;
  }
  
  if (cleaned.length === 11 && cleaned.startsWith("0")) {
    return cleaned;
  }
  
  return cleaned;
}

export interface CreateVirtualAccountParams {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  bvn?: string;
  nin?: string;
  isPermanent?: boolean;
}

export interface VirtualAccountResponse {
  account_number: string;
  bank_name: string;
  account_name: string;
  order_ref: string;
  flw_ref: string;
}

/**
 * Create a Flutterwave virtual account (static/permanent or temporary)
 */
export async function createVirtualAccount(
  params: CreateVirtualAccountParams
) {
  try {
    const authHeader = await getAuthHeader();
    const normalizedPhone = normalizeMobileNumber(params.phoneNumber);

    // Flutterwave requires BVN/NIN for static accounts
    // If no BVN/NIN, create dynamic account (temporary, requires amount)
    // If BVN/NIN provided, create static account (permanent, no amount needed)
    const hasBVNOrNIN = !!(params.bvn || params.nin);
    
    const requestBody: any = {
      email: params.email,
      firstname: params.firstName,
      lastname: params.lastName,
      phonenumber: normalizedPhone,
      tx_ref: `VA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      is_permanent: hasBVNOrNIN, // Static only if BVN/NIN provided
    };

    // Add BVN or NIN if provided (creates static account)
    if (params.bvn) {
      requestBody.bvn = params.bvn;
      requestBody.is_permanent = true;
    } else if (params.nin) {
      requestBody.nin = params.nin;
      requestBody.is_permanent = true;
    } else {
      // Dynamic account requires amount (minimum 1 NGN)
      // Note: Dynamic accounts expire after use, but we'll upgrade to static when BVN is verified
      requestBody.amount = 1; // Minimum amount for dynamic accounts
    }

    // v4 API uses different endpoint
    const endpoint = USE_V4_API 
      ? `${FLUTTERWAVE_API_BASE}/virtual-account-numbers`
      : `${FLUTTERWAVE_API_BASE}/virtual-account-numbers`;

    const response = await axios.post(
      endpoint,
      requestBody,
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.status === "success") {
      return {
        success: true,
        data: response.data.data as VirtualAccountResponse,
      };
    }

    return {
      success: false,
      error: response.data.message || "Failed to create virtual account",
    };
  } catch (error: any) {
    console.error("Flutterwave virtual account creation error:", error);
    console.error("Error response:", error.response?.data);
    console.error("Error status:", error.response?.status);
    console.error("Error headers:", error.response?.headers);
    
    // Extract more detailed error message
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error || 
                        error.message || 
                        "Failed to create virtual account";
    
    return {
      success: false,
      error: errorMessage,
      details: {
        ...error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
      },
    };
  }
}

export interface TransferParams {
  accountBank: string;
  accountNumber: string;
  amount: number;
  currency?: string;
  narration?: string;
  reference?: string;
}

/**
 * Create a Flutterwave transfer
 */
export async function createTransfer(params: TransferParams) {
  try {
    const authHeader = await getAuthHeader();

    // v4 API uses different endpoint and structure
    const endpoint = USE_V4_API 
      ? `${FLUTTERWAVE_API_BASE}/transfers`
      : `${FLUTTERWAVE_API_BASE}/transfers`;

    const response = await axios.post(
      endpoint,
      {
        account_bank: params.accountBank,
        account_number: params.accountNumber,
        amount: params.amount,
        currency: params.currency || "NGN",
        debit_currency: "NGN",
        narration: params.narration || "Transfer",
        reference: params.reference || `TX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      },
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.status === "success") {
      return {
        success: true,
        data: response.data.data,
      };
    }

    return {
      success: false,
      error: response.data.message || "Failed to create transfer",
    };
  } catch (error: any) {
    console.error("Flutterwave transfer error:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to create transfer",
      details: error.response?.data,
    };
  }
}

/**
 * Verify Flutterwave webhook signature
 * According to Flutterwave docs, webhooks use a separate secret hash
 * configured in the dashboard (Settings > Webhooks > Secret hash)
 * 
 * The verif-hash header contains the hash that should match our computed hash
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const crypto = require("crypto");
  
  // Use webhook secret hash if configured, otherwise fall back to API secret key
  // The webhook secret hash is set in Flutterwave dashboard (Settings > Webhooks)
  const secretHash = FLUTTERWAVE_WEBHOOK_SECRET_HASH || FLUTTERWAVE_SECRET_KEY || "";
  
  if (!secretHash) {
    console.warn("[Flutterwave] No webhook secret hash configured. Using API secret key as fallback.");
    // Still try to verify, but log warning
  }
  
  // According to Flutterwave docs, signature is computed using HMAC-SHA256 and returned as base64
  // But v3 API might use hex format. Try both formats.
  
  // Format 1: Base64 (as per Flutterwave v4 documentation)
  const computedHashBase64 = crypto
    .createHmac("sha256", secretHash)
    .update(payload)
    .digest("base64");
  
  // Format 2: Hex (v3 API format)
  const computedHashHex = crypto
    .createHmac("sha256", secretHash)
    .update(payload)
    .digest("hex");

  // Compare the received signature with both computed hashes
  // Flutterwave might send it in either format depending on API version
  const isValidBase64 = computedHashBase64 === signature;
  const isValidHex = computedHashHex === signature;
  
  if (isValidBase64 || isValidHex) {
    console.log(`[Flutterwave] ✅ Signature verification successful (format: ${isValidBase64 ? 'base64' : 'hex'})`);
    return true;
  }
  
  // Enhanced error logging for debugging
  console.error(`[Flutterwave] ❌ Signature mismatch detected`);
  console.error(`[Flutterwave] Expected (base64): ${computedHashBase64.substring(0, 30)}...`);
  console.error(`[Flutterwave] Expected (hex): ${computedHashHex.substring(0, 30)}...`);
  console.error(`[Flutterwave] Received: ${signature.substring(0, 30)}...`);
  console.error(`[Flutterwave] Secret hash configured: ${secretHash ? 'YES (length: ' + secretHash.length + ')' : 'NO'}`);
  console.error(`[Flutterwave] Using webhook secret hash: ${!!FLUTTERWAVE_WEBHOOK_SECRET_HASH}`);
  console.error(`[Flutterwave] ⚠️ TROUBLESHOOTING: Ensure FLUTTERWAVE_WEBHOOK_SECRET_HASH in Vercel exactly matches the secret hash in Flutterwave Dashboard > Settings > Webhooks`);
  
  return false;
}

/**
 * Verify bank account number and get account holder name
 * Uses Flutterwave's account resolution API
 */
export async function verifyBankAccount(accountNumber: string, bankCode: string) {
  try {
    const authHeader = await getAuthHeader();

    console.log(`[Flutterwave Verify Account] Verifying account ${accountNumber} with bank ${bankCode}`);
    console.log(`[Flutterwave Verify Account] API Base: ${FLUTTERWAVE_API_BASE}`);
    console.log(`[Flutterwave Verify Account] API Version: ${USE_V4_API ? 'v4' : 'v3'}`);
    console.log(`[Flutterwave Verify Account] Test Mode: ${FLUTTERWAVE_USE_TEST_MODE}`);

    // v4 API uses different endpoint structure
    const endpoint = USE_V4_API 
      ? `${FLUTTERWAVE_API_BASE}/accounts/resolve`
      : `${FLUTTERWAVE_API_BASE}/accounts/resolve`;

    const response = await axios.post(
      endpoint,
      {
        account_number: accountNumber,
        account_bank: bankCode,
      },
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`[Flutterwave Verify Account] Response status: ${response.data.status}`);
    console.log(`[Flutterwave Verify Account] Response data:`, JSON.stringify(response.data, null, 2));

    if (response.data.status === "success" && response.data.data) {
      const accountName = response.data.data.account_name;
      const accountNumberFromResponse = response.data.data.account_number;
      
      if (!accountName) {
        console.warn("[Flutterwave Verify Account] Account name is missing in response");
        return {
          success: false,
          error: "Account verified but name not available",
          details: response.data,
        };
      }

      return {
        success: true,
        data: {
          accountNumber: accountNumberFromResponse || accountNumber,
          accountName: accountName,
        },
      };
    }

    const errorMessage = response.data.message || "Failed to verify account";
    console.error(`[Flutterwave Verify Account] Verification failed: ${errorMessage}`);
    
    // Provide helpful error message for test mode limitations
    let userFriendlyError = errorMessage;
    if (FLUTTERWAVE_USE_TEST_MODE && bankCode !== "044") {
      userFriendlyError = `Account verification in test mode only supports Access Bank (044). For other banks, please use production mode or contact support. Original error: ${errorMessage}`;
    } else if (errorMessage.toLowerCase().includes("invalid") || errorMessage.toLowerCase().includes("not found")) {
      userFriendlyError = `Invalid account number or bank code. Please verify the account number and selected bank are correct.`;
    }
    
    return {
      success: false,
      error: userFriendlyError,
      details: response.data,
      isTestMode: FLUTTERWAVE_USE_TEST_MODE,
    };
  } catch (error: any) {
    console.error("[Flutterwave Verify Account] Error:", error);
    console.error("[Flutterwave Verify Account] Error response:", error.response?.data);
    
    let errorMessage = "Failed to verify account";
    
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.response?.status === 401) {
      errorMessage = "Authentication failed. Please check your API credentials.";
    } else if (error.response?.status === 400) {
      const apiError = error.response.data?.message || "Invalid account number or bank code";
      // Provide helpful context for test mode
      if (FLUTTERWAVE_USE_TEST_MODE && bankCode !== "044") {
        errorMessage = `Account verification in test mode only supports Access Bank (044). For other banks, please use production mode. Original error: ${apiError}`;
      } else {
        errorMessage = apiError;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage,
      details: error.response?.data,
      isTestMode: FLUTTERWAVE_USE_TEST_MODE,
    };
  }
}

/**
 * Get Flutterwave account balance
 */
export async function getAccountBalance() {
  try {
    const authHeader = await getAuthHeader();

    // v4 API uses different endpoint
    const endpoint = USE_V4_API 
      ? `${FLUTTERWAVE_API_BASE}/balances/NGN`
      : `${FLUTTERWAVE_API_BASE}/balances/NGN`;

    const response = await axios.get(
      endpoint,
      {
        headers: {
          Authorization: authHeader,
        },
      }
    );

    if (response.data.status === "success") {
      return {
        success: true,
        data: response.data.data,
      };
    }

    return {
      success: false,
      error: response.data.message || "Failed to get balance",
    };
  } catch (error: any) {
    console.error("Flutterwave balance error:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to get balance",
    };
  }
}

export interface InitializePaymentParams {
  email: string;
  amount: number; // Amount in NGN (not kobo)
  txRef: string; // Unique transaction reference
  callbackUrl?: string;
  redirectUrl?: string;
  metadata?: Record<string, any>;
  customer?: {
    email: string;
    name?: string;
    phone_number?: string;
  };
}

export interface PaymentLinkResponse {
  link: string; // Payment link URL
  status: string;
  message: string;
  data: {
    link: string;
    status: string;
  };
}

/**
 * Initialize Flutterwave payment (creates payment link/checkout)
 * Similar to Paystack's initializeTransaction but uses Flutterwave API
 */
export async function initializePayment(
  params: InitializePaymentParams
): Promise<{ success: boolean; data?: PaymentLinkResponse["data"]; error?: string }> {
  try {
    // Get authentication header (v4 uses OAuth2 token, v3 uses secret key)
    let authHeader: string;
    if (USE_V4_API) {
      const accessToken = await getAccessToken();
      authHeader = `Bearer ${accessToken}`;
    } else {
      if (!FLUTTERWAVE_SECRET_KEY) {
        return {
          success: false,
          error: "Flutterwave credentials not configured",
        };
      }
      authHeader = `Bearer ${FLUTTERWAVE_SECRET_KEY}`;
    }

    const requestBody: any = {
      tx_ref: params.txRef,
      amount: params.amount, // Flutterwave expects amount in NGN (not kobo)
      currency: "NGN",
      redirect_url: params.redirectUrl || params.callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment/callback`,
      payment_options: "card,account,ussd,transfer,banktransfer",
      customer: {
        email: params.customer?.email || params.email,
        name: params.customer?.name || "Customer",
        phone_number: params.customer?.phone_number || "",
      },
      customizations: {
        title: "SEND Token Purchase",
        description: "Purchase SEND tokens with Naira",
        logo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/logo.png`,
      },
    };

    // Add metadata if provided
    if (params.metadata) {
      requestBody.meta = params.metadata;
    }

    console.log(`[Flutterwave Payment] Initializing payment: ${params.amount} NGN, txRef: ${params.txRef}`);
    console.log(`[Flutterwave Payment] Using API: ${USE_V4_API ? 'v4' : 'v3'}`);

    // v4 API uses different endpoint structure
    const endpoint = USE_V4_API 
      ? `${FLUTTERWAVE_API_BASE}/charges`
      : `${FLUTTERWAVE_API_BASE}/payments`;

    const response = await axios.post(
      endpoint,
      requestBody,
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`[Flutterwave Payment] Response:`, response.data);

    // v4 API might have different response structure
    // Check for both v3 and v4 response formats
    const responseData = response.data;
    const isSuccess = responseData.status === "success" || 
                     responseData.status === "succeeded" ||
                     (responseData.data && (responseData.data.link || responseData.data.authorization_url));

    if (isSuccess) {
      // v4 API response structure might be different
      const link = responseData.data?.link || 
                   responseData.data?.authorization_url || 
                   responseData.link ||
                   responseData.authorization_url;
      
      if (link) {
        return {
          success: true,
          data: {
            link: link,
            status: responseData.status || "success",
          },
        };
      }
    }

    return {
      success: false,
      error: response.data.message || "Failed to initialize payment",
    };
  } catch (error: any) {
    console.error("[Flutterwave Payment] Initialization error:", error);
    console.error("[Flutterwave Payment] Error response:", error.response?.data);
    
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error || 
                        error.message || 
                        "Failed to initialize payment";
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Verify Flutterwave payment transaction
 */
export async function verifyPayment(txRef: string) {
  try {
    // Get authentication header (v4 uses OAuth2 token, v3 uses secret key)
    let authHeader: string;
    if (USE_V4_API) {
      const accessToken = await getAccessToken();
      authHeader = `Bearer ${accessToken}`;
    } else {
      if (!FLUTTERWAVE_SECRET_KEY) {
        return {
          success: false,
          error: "Flutterwave credentials not configured",
        };
      }
      authHeader = `Bearer ${FLUTTERWAVE_SECRET_KEY}`;
    }

    // v4 API uses different endpoint structure
    const endpoint = USE_V4_API 
      ? `${FLUTTERWAVE_API_BASE}/charges/${txRef}`
      : `${FLUTTERWAVE_API_BASE}/transactions/${txRef}/verify`;

    const response = await axios.get(
      endpoint,
      {
        headers: {
          Authorization: authHeader,
        },
      }
    );

    // v4 API might have different response structure
    const responseData = response.data;
    const isSuccess = responseData.status === "success" || 
                     responseData.status === "succeeded" ||
                     (responseData.data && responseData.data.status === "successful");

    if (isSuccess) {
      return {
        success: true,
        data: responseData.data || responseData,
      };
    }

    return {
      success: false,
      error: responseData.message || responseData.error || "Failed to verify payment",
    };
  } catch (error: any) {
    console.error("[Flutterwave Payment] Verification error:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to verify payment",
    };
  }
}
