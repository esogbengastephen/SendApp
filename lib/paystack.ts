import axios from "axios";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

if (!PAYSTACK_SECRET_KEY) {
  console.warn("PAYSTACK_SECRET_KEY is not set in environment variables");
}

if (!PAYSTACK_PUBLIC_KEY) {
  console.warn("NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY is not set in environment variables");
}

const PAYSTACK_API_BASE = "https://api.paystack.co";

export interface InitializeTransactionParams {
  email: string;
  amount: number; // Amount in kobo (NGN * 100)
  reference?: string;
  callback_url?: string;
  metadata?: Record<string, any>;
}

export interface VerifyTransactionResponse {
  status: boolean;
  message: string;
  data: {
    amount: number;
    currency: string;
    status: string;
    reference: string;
    customer: {
      email: string;
    };
    metadata?: Record<string, any>;
  };
}

/**
 * Initialize a Paystack transaction
 */
export async function initializeTransaction(
  params: InitializeTransactionParams
) {
  try {
    const response = await axios.post(
      `${PAYSTACK_API_BASE}/transaction/initialize`,
      {
        email: params.email,
        amount: params.amount,
        reference: params.reference,
        callback_url: params.callback_url,
        metadata: params.metadata,
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error: any) {
    console.error("Paystack initialization error:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to initialize transaction",
    };
  }
}

/**
 * Verify a Paystack transaction
 */
export async function verifyTransaction(reference: string) {
  try {
    const response = await axios.get(
      `${PAYSTACK_API_BASE}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    return {
      success: true,
      data: response.data.data as VerifyTransactionResponse["data"],
    };
  } catch (error: any) {
    console.error("Paystack verification error:", error);
    return {
      success: false,
      error: error.response?.data?.message || "Failed to verify transaction",
    };
  }
}

/**
 * Verify Paystack webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const crypto = require("crypto");
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET_KEY || "")
    .update(payload)
    .digest("hex");

  return hash === signature;
}

