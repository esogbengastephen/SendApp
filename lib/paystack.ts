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

/** Cached Paystack bank list: { code, name } */
let paystackBanksCache: { code: string; name: string }[] | null = null;
let paystackBanksCacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

async function getPaystackBanks(): Promise<{ code: string; name: string }[]> {
  if (paystackBanksCache && Date.now() - paystackBanksCacheTime < CACHE_TTL_MS) {
    return paystackBanksCache;
  }
  if (!PAYSTACK_SECRET_KEY?.trim()) return [];
  try {
    const res = await axios.get<{ data?: { code: string; name: string }[] }>(
      `${PAYSTACK_API_BASE}/bank`,
      { params: { country: "nigeria" }, headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY.trim()}` }, timeout: 10000 }
    );
    const list = res.data?.data;
    if (Array.isArray(list) && list.length) {
      paystackBanksCache = list.map((b) => ({ code: String(b.code ?? ""), name: String(b.name ?? "").trim() })).filter((b) => b.code && b.name);
      paystackBanksCacheTime = Date.now();
      return paystackBanksCache!;
    }
  } catch (_) {}
  return paystackBanksCache ?? [];
}

/**
 * Get Paystack bank code by bank name (e.g. "OPay").
 * Use when the UI sends the selected bank name so we can resolve even if code differs from our static list.
 */
export async function getPaystackBankCodeFromName(bankName: string): Promise<string | null> {
  const name = String(bankName ?? "").trim();
  if (!name) return null;
  const list = await getPaystackBanks();
  const nameLower = name.toLowerCase();
  const exact = list.find((b) => b.name.toLowerCase() === nameLower);
  if (exact) return exact.code;
  const partial = list.find((b) => b.name.toLowerCase().includes(nameLower) || nameLower.includes(b.name.toLowerCase()));
  return partial?.code ?? null;
}

/**
 * Map our bank code (e.g. Flutterwave 100022) to Paystack bank code by matching bank name.
 */
export async function getPaystackBankCodeFromOurCode(ourBankCode: string): Promise<string | null> {
  const { getBankByCode } = await import("./nigerian-banks");
  const bank = getBankByCode(ourBankCode);
  const name = bank?.name?.trim();
  if (!name) return ourBankCode; // pass through
  const list = await getPaystackBanks();
  const nameLower = name.toLowerCase();
  const exact = list.find((b) => b.name.toLowerCase() === nameLower);
  if (exact) return exact.code;
  const partial = list.find((b) => b.name.toLowerCase().includes(nameLower) || nameLower.includes(b.name.toLowerCase()));
  return partial?.code ?? ourBankCode;
}

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
 * Resolve bank account number (get account name).
 * GET /bank/resolve?account_number=xxx&bank_code=xxx
 * Use as fallback when Flutterwave verification fails (e.g. OPay, Palmpay).
 * Maps our bank code to Paystack's via bank name when needed.
 */
export async function resolveBankAccount(
  accountNumber: string,
  bankCode: string,
  options?: { bankName?: string }
): Promise<
  | { success: true; data: { accountName: string; accountNumber: string } }
  | { success: false; error: string }
> {
  if (!PAYSTACK_SECRET_KEY?.trim()) {
    return { success: false, error: "Paystack not configured" };
  }
  const account = String(accountNumber).replace(/\D/g, "").slice(0, 10);
  const code = String(bankCode ?? "").trim();
  if (account.length !== 10) {
    return { success: false, error: "Invalid account number" };
  }
  const tryResolve = async (paystackCode: string) => {
    const response = await axios.get(
      `${PAYSTACK_API_BASE}/bank/resolve`,
      {
        params: { account_number: account, bank_code: paystackCode },
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY!.trim()}` },
        timeout: 10000,
      }
    );
    const data = response.data?.data;
    const name = data?.account_name;
    if (response.data?.status && name) {
      return {
        success: true as const,
        data: {
          accountName: name,
          accountNumber: data.account_number ?? account,
        },
      };
    }
    return {
      success: false as const,
      error: response.data?.message || "Account could not be resolved",
    };
  };
  try {
    const bankName = options?.bankName?.trim();
    if (bankName) {
      const codeByName = await getPaystackBankCodeFromName(bankName);
      if (codeByName) {
        const result = await tryResolve(codeByName);
        if (result.success) return result;
      }
    }
    let result = await tryResolve(code);
    if (result.success) return result;
    const paystackCode = await getPaystackBankCodeFromOurCode(code);
    if (paystackCode && paystackCode !== code) {
      result = await tryResolve(paystackCode);
    }
    return result;
  } catch (err: any) {
    const msg = err.response?.data?.message || err.message || "Paystack resolve failed";
    return { success: false, error: msg };
  }
}

export function isPaystackResolveConfigured(): boolean {
  return !!PAYSTACK_SECRET_KEY?.trim();
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

