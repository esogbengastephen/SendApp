import axios from "axios";

const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;
const FLUTTERWAVE_PUBLIC_KEY = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY;
const FLUTTERWAVE_USE_TEST_MODE = process.env.FLUTTERWAVE_USE_TEST_MODE === "true" || 
                                   process.env.NODE_ENV === "development";

if (!FLUTTERWAVE_SECRET_KEY) {
  console.warn("FLUTTERWAVE_SECRET_KEY is not set in environment variables");
}

if (!FLUTTERWAVE_PUBLIC_KEY) {
  console.warn("NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY is not set in environment variables");
}

// Use sandbox URL for test mode, production URL for live mode
const FLUTTERWAVE_API_BASE = FLUTTERWAVE_USE_TEST_MODE 
  ? "https://developersandbox-api.flutterwave.com/v3"
  : "https://api.flutterwave.com/v3";

console.log(`[Flutterwave] Using ${FLUTTERWAVE_USE_TEST_MODE ? 'TEST/SANDBOX' : 'PRODUCTION'} API: ${FLUTTERWAVE_API_BASE}`);

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
    if (!FLUTTERWAVE_SECRET_KEY) {
      return {
        success: false,
        error: "Flutterwave secret key not configured",
      };
    }

    const normalizedPhone = normalizeMobileNumber(params.phoneNumber);

    const requestBody: any = {
      email: params.email,
      firstname: params.firstName,
      lastname: params.lastName,
      phonenumber: normalizedPhone,
      tx_ref: `VA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      is_permanent: params.isPermanent || false,
    };

    // Add BVN or NIN if provided (for static/permanent accounts)
    if (params.bvn) {
      requestBody.bvn = params.bvn;
      requestBody.is_permanent = true;
    } else if (params.nin) {
      requestBody.nin = params.nin;
      requestBody.is_permanent = true;
    }

    const response = await axios.post(
      `${FLUTTERWAVE_API_BASE}/virtual-account-numbers`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
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
    if (!FLUTTERWAVE_SECRET_KEY) {
      return {
        success: false,
        error: "Flutterwave secret key not configured",
      };
    }

    const response = await axios.post(
      `${FLUTTERWAVE_API_BASE}/transfers`,
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
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
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
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const crypto = require("crypto");
  const hash = crypto
    .createHmac("sha256", FLUTTERWAVE_SECRET_KEY || "")
    .update(payload)
    .digest("hex");

  return hash === signature;
}

/**
 * Get Flutterwave account balance
 */
export async function getAccountBalance() {
  try {
    if (!FLUTTERWAVE_SECRET_KEY) {
      return {
        success: false,
        error: "Flutterwave secret key not configured",
      };
    }

    const response = await axios.get(
      `${FLUTTERWAVE_API_BASE}/balances/NGN`,
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
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
