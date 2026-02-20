import axios from "axios";

// Flutterwave V3 API (this app uses V3 only for transfers and payouts)
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;
const FLUTTERWAVE_PUBLIC_KEY = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY;

const FLUTTERWAVE_WEBHOOK_SECRET_HASH = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;

// Use live (production) mode by default. Set FLUTTERWAVE_USE_TEST_MODE=true for sandbox only.
const FLUTTERWAVE_USE_TEST_MODE = process.env.FLUTTERWAVE_USE_TEST_MODE === "true";

// This app uses Flutterwave V3 only for transfers and payouts (V4 not used).
const USE_V4_API = false;

// V3 API base URLs
const FLUTTERWAVE_API_BASE = FLUTTERWAVE_USE_TEST_MODE
  ? "https://developersandbox-api.flutterwave.com/v3"
  : "https://api.flutterwave.com/v3";

console.log(`[Flutterwave] Using v3 API (Bearer) - ${FLUTTERWAVE_USE_TEST_MODE ? "TEST" : "PRODUCTION"}: ${FLUTTERWAVE_API_BASE}`);
if (!FLUTTERWAVE_SECRET_KEY) {
  console.warn("[Flutterwave] Set FLUTTERWAVE_SECRET_KEY for transfers and account verification.");
}

/**
 * Get authentication header for Flutterwave V3 API (Bearer secret key).
 */
async function getAuthHeader(): Promise<string> {
  if (!FLUTTERWAVE_SECRET_KEY) {
    throw new Error("Flutterwave credentials not configured. Set FLUTTERWAVE_SECRET_KEY.");
  }
  const secretKey = FLUTTERWAVE_SECRET_KEY.trim();
  if (!secretKey) {
    throw new Error("Flutterwave secret key is empty. Check for whitespace issues.");
  }
  return `Bearer ${secretKey}`;
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

    const response = await axios.post(
      `${FLUTTERWAVE_API_BASE}/virtual-account-numbers`,
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
 * Create a Flutterwave transfer (NGN bank payout).
 * v4: POST /direct-transfers (Flutterwave docs Step 3 — Initiate the Transfer)
 *     Body: action, type, reference, payment_instruction (source_currency, amount, recipient.bank, destination_currency)
 * v3: POST /transfers with account_bank, account_number, amount, etc.
 */
export async function createTransfer(params: TransferParams) {
  const reference = params.reference || `TX-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const amount = Math.round(Number(params.amount)) || 0;
  const currency = params.currency || "NGN";

  if (amount <= 0) {
    return { success: false as const, error: "Invalid transfer amount" };
  }

  try {
    const authHeader = await getAuthHeader();

    // V3: POST /transfers
    const response = await axios.post(
      `${FLUTTERWAVE_API_BASE}/transfers`,
      {
        account_bank: params.accountBank,
        account_number: String(params.accountNumber).replace(/\D/g, "").slice(0, 10),
        amount,
        currency,
        debit_currency: "NGN",
        narration: params.narration || "Transfer",
        reference,
      },
      {
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        timeout: 30000,
      }
    );

    if (response.data.status === "success") {
      return { success: true as const, data: response.data.data };
    }

    return {
      success: false as const,
      error: response.data.message || "Failed to create transfer",
    };
  } catch (error: any) {
    console.error("[Flutterwave Transfer] Error:", error.response?.data ?? error.message);
    const errMsg = error.response?.data?.message ?? error.response?.data?.error?.message ?? "Failed to create transfer";
    return {
      success: false as const,
      error: errMsg,
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
  
  // Flutterwave v3 fallback: some configurations send the secret hash itself in verif-hash
  // (e.g. when "Secret hash" is used as a shared secret rather than HMAC key).
  // Accept if the header exactly matches our configured secret hash.
  if (secretHash && signature === secretHash) {
    console.log(`[Flutterwave] ✅ Signature verification successful (v3 exact secret match)`);
    return true;
  }
  
  // Trimmed comparison in case of whitespace
  if (secretHash && signature.trim() === secretHash.trim()) {
    console.log(`[Flutterwave] ✅ Signature verification successful (v3 exact secret match, trimmed)`);
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

/** Cache Flutterwave bank list (code -> Flutterwave code) for resolve. */
let fwBankCodeCache: Map<string, string> | null = null;
let fwBankCodeCacheTime = 0;
const FW_BANK_CACHE_MS = 60 * 60 * 1000;

async function getFlutterwaveBankCodeForResolve(ourBankCode: string): Promise<string> {
  if (fwBankCodeCache && Date.now() - fwBankCodeCacheTime < FW_BANK_CACHE_MS) {
    return fwBankCodeCache.get(ourBankCode) ?? ourBankCode;
  }
  try {
    const authHeader = await getAuthHeader();
    const res = await axios.get(`${FLUTTERWAVE_API_BASE}/banks/NG`, {
      headers: { Authorization: authHeader },
      timeout: 10000,
    });
    if (res.data?.status === "success" && Array.isArray(res.data.data)) {
      fwBankCodeCache = new Map();
      for (const b of res.data.data) {
        const fwCode = String(b.code ?? b.id ?? "").trim();
        if (!fwCode) continue;
        fwBankCodeCache.set(fwCode, fwCode);
        const name = (b.name ?? "").toLowerCase();
        if (name.includes("opay")) fwBankCodeCache.set("100022", fwCode);
        if (name.includes("palmpay")) fwBankCodeCache.set("100023", fwCode);
        if (name.includes("moniepoint")) fwBankCodeCache.set("100024", fwCode);
        if (name.includes("kuda")) fwBankCodeCache.set("50211", fwCode);
      }
      fwBankCodeCacheTime = Date.now();
      return fwBankCodeCache.get(ourBankCode) ?? ourBankCode;
    }
  } catch (e) {
    console.warn("[Flutterwave Verify Account] Could not fetch bank list:", (e as Error).message);
  }
  return ourBankCode;
}

/**
 * Verify bank account number and get account holder name.
 * v4: POST /banks/account-resolve (Flutterwave docs Step 2)
 *     Body: { account: { code, number }, currency: "NGN" } → data.account_name
 * v3: POST /accounts/resolve or /banks/account-resolve with account_bank + account_number
 */
export async function verifyBankAccount(accountNumber: string, bankCode: string) {
  const accountNumberClean = String(accountNumber).replace(/\D/g, "").slice(0, 10);
  const bankCodeTrimmed = String(bankCode ?? "").trim();
  if (accountNumberClean.length !== 10 || !bankCodeTrimmed) {
    return {
      success: false as const,
      error: "Invalid account number or bank code",
      isTestMode: FLUTTERWAVE_USE_TEST_MODE,
    };
  }

  try {
    const authHeader = await getAuthHeader();
    const accountBank = await getFlutterwaveBankCodeForResolve(bankCodeTrimmed);

    console.log(`[Flutterwave Verify] account=${accountNumberClean} bank=${bankCodeTrimmed} (FW code=${accountBank}) base=${FLUTTERWAVE_API_BASE}`);

    const requestConfig = {
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      timeout: 15000,
    };

    // V3: POST /accounts/resolve or /banks/account-resolve
    const payload = { account_number: accountNumberClean, account_bank: accountBank };
    let response: any;
    try {
      response = await axios.post(`${FLUTTERWAVE_API_BASE}/accounts/resolve`, payload, requestConfig);
    } catch (firstErr: any) {
      if (firstErr.response?.status === 404) {
        response = await axios.post(`${FLUTTERWAVE_API_BASE}/banks/account-resolve`, payload, requestConfig);
      } else {
        throw firstErr;
      }
    }

    const data = response.data?.data;
    const status = response.data?.status;
    const accountName = data?.account_name;
    const accountNumberFromResponse = data?.account_number;

    if (status === "success" && accountName) {
      console.log(`[Flutterwave Verify] Resolved: ${accountName}`);
      return {
        success: true as const,
        data: {
          accountNumber: accountNumberFromResponse || accountNumberClean,
          accountName: String(accountName),
        },
      };
    }

    const errorMessage = response.data?.message || response.data?.error?.message || "Failed to verify account";
    console.error(`[Flutterwave Verify] Failed: ${errorMessage}`);

    let userFriendlyError = /invalid|not found|incorrect|could not/i.test(errorMessage)
      ? "Account could not be verified. Check account number and bank (e.g. OPay, Palmpay, GTBank)."
      : errorMessage;
    if (FLUTTERWAVE_USE_TEST_MODE) {
      userFriendlyError += " For live banks use FLUTTERWAVE_USE_TEST_MODE=false and live keys.";
    }

    return {
      success: false as const,
      error: userFriendlyError,
      details: response.data,
      isTestMode: FLUTTERWAVE_USE_TEST_MODE,
    };
  } catch (error: any) {
    console.error("[Flutterwave Verify] Error:", error.response?.data ?? error.message);

    let errorMessage = "Failed to verify account";
    const apiMsg = error.response?.data?.message ?? error.response?.data?.error?.message;
    if (apiMsg) {
      errorMessage = /invalid|not found|incorrect/i.test(apiMsg)
        ? "Account could not be verified. Check account number and bank (e.g. OPay, Palmpay, GTBank)."
        : apiMsg;
    } else if (error.response?.status === 401) {
      errorMessage = "Authentication failed. Check FLW_CLIENT_ID and FLW_CLIENT_SECRET (v4) or FLUTTERWAVE_SECRET_KEY (v3).";
    }
    if (FLUTTERWAVE_USE_TEST_MODE) {
      errorMessage += " For live banks use FLUTTERWAVE_USE_TEST_MODE=false and live keys.";
    }

    return {
      success: false as const,
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
 * V3: POST /payments
 */
export async function initializePayment(
  params: InitializePaymentParams
): Promise<{ success: boolean; data?: PaymentLinkResponse["data"]; error?: string }> {
  try {
    if (!FLUTTERWAVE_SECRET_KEY?.trim()) {
      return { success: false, error: "Flutterwave credentials not configured. Set FLUTTERWAVE_SECRET_KEY." };
    }
    const authHeader = `Bearer ${FLUTTERWAVE_SECRET_KEY.trim()}`;

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
    console.log(`[Flutterwave Payment] Using API: ${USE_V4_API ? "v4" : "v3"}`);

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

    // v4 API might have different response structure; v3 uses /payments
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
    if (!FLUTTERWAVE_SECRET_KEY?.trim()) {
      return { success: false, error: "Flutterwave credentials not configured. Set FLUTTERWAVE_SECRET_KEY." };
    }
    const authHeader = `Bearer ${FLUTTERWAVE_SECRET_KEY.trim()}`;
    const endpoint = `${FLUTTERWAVE_API_BASE}/transactions/${txRef}/verify`;

    const response = await axios.get(
      endpoint,
      {
        headers: {
          Authorization: authHeader,
        },
      }
    );

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
