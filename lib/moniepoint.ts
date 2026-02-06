/**
 * Moniepoint & Monnify API integration for off-ramp
 * - Bank account verification (name enquiry)
 * - Payout/transfer to be used when SEND is confirmed on-chain
 *
 * Supports two modes:
 * 1. Monnify: Basic auth, base URL monnify.com (API Key + Secret from Monnify dashboard)
 * 2. Moniepoint native: Bearer token auth when MONIEPOINT_BASE_URL contains "moniepoint"
 *    (Client ID + API Key from atm.moniepoint.com)
 *
 * Env: MONIEPOINT_API_KEY or MONIEPOINT_CLIENT_ID, MONIEPOINT_SECRET_KEY,
 *      MONIEPOINT_BASE_URL (optional; if set to Moniepoint URL, uses token auth)
 */

import axios, { AxiosError } from "axios";

const MONIEPOINT_API_KEY =
  process.env.MONIEPOINT_API_KEY ||
  process.env.MONIEPOINT_CLIENT_ID ||
  process.env.MONNIFY_API_KEY;
const MONIEPOINT_SECRET_KEY =
  process.env.MONIEPOINT_SECRET_KEY || process.env.MONNIFY_SECRET_KEY;
const MONIEPOINT_BASE_URL = process.env.MONIEPOINT_BASE_URL?.trim() || "";
const MONIEPOINT_AUTH_URL = process.env.MONIEPOINT_AUTH_URL?.trim() || "";

const isMoniepointNative =
  MONIEPOINT_BASE_URL.length > 0 &&
  MONIEPOINT_BASE_URL.toLowerCase().includes("moniepoint");

const defaultMonnifyBase =
  process.env.NODE_ENV === "production"
    ? "https://api.monnify.com"
    : "https://sandbox.monnify.com";

const effectiveBaseUrl = MONIEPOINT_BASE_URL || defaultMonnifyBase;

/** Get Bearer token from Moniepoint auth endpoint (for native Moniepoint API) */
async function getMoniepointBearerToken(): Promise<string> {
  if (!MONIEPOINT_API_KEY || !MONIEPOINT_SECRET_KEY) {
    throw new Error("Moniepoint API credentials not configured");
  }
  const base = effectiveBaseUrl.replace(/\/v1\/?$/, "").replace(/\/$/, "");
  const body = {
    clientId: MONIEPOINT_API_KEY,
    clientSecret: MONIEPOINT_SECRET_KEY,
  };
  const urlsToTry: string[] = [];
  if (MONIEPOINT_AUTH_URL) urlsToTry.push(MONIEPOINT_AUTH_URL);
  urlsToTry.push(
    `${base}/v1/auth/token`,
    `${base}/auth/token`,
    `${effectiveBaseUrl}/auth/token`
  );
  let lastError: unknown;
  for (const tokenUrl of urlsToTry) {
    try {
      const res = await axios.post(tokenUrl, body, {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
        validateStatus: () => true,
      });
      const token =
        res.data?.accessToken ?? res.data?.access_token ?? res.data?.token;
      if (res.status === 200 && token) {
        return token;
      }
      lastError = { status: res.status, data: res.data, url: tokenUrl };
    } catch (e) {
      lastError = e;
    }
  }
  const ax = lastError as AxiosError<{ message?: string }>;
  const status = ax.response?.status;
  const msg =
    ax.response?.data?.message ??
    (ax.response?.data as Record<string, unknown>)?.error_description ??
    ax.message ??
    "No message available";
  const out = `${typeof msg === "string" ? msg : JSON.stringify(msg)} (HTTP ${status ?? "?"})`;
  throw new Error(out);
}

function getMonnifyBasicAuthHeader(): string {
  if (!MONIEPOINT_API_KEY || !MONIEPOINT_SECRET_KEY) {
    throw new Error(
      "Moniepoint API credentials not configured (MONIEPOINT_API_KEY, MONIEPOINT_SECRET_KEY)"
    );
  }
  const credentials = Buffer.from(
    `${MONIEPOINT_API_KEY}:${MONIEPOINT_SECRET_KEY}`
  ).toString("base64");
  return `Basic ${credentials}`;
}

export function isMoniepointConfigured(): boolean {
  return Boolean(MONIEPOINT_API_KEY && MONIEPOINT_SECRET_KEY);
}

export interface VerifyBankAccountResult {
  success: boolean;
  data?: {
    accountNumber: string;
    accountName: string;
  };
  error?: string;
}

/**
 * Verify bank account and get account holder name (name enquiry).
 * Tries Moniepoint native (Bearer) if base URL is Moniepoint, else Monnify (Basic).
 */
export async function verifyBankAccount(
  accountNumber: string,
  bankCode: string
): Promise<VerifyBankAccountResult> {
  if (!isMoniepointConfigured()) {
    return {
      success: false,
      error:
        "Moniepoint API is not configured. Set MONIEPOINT_API_KEY (or MONIEPOINT_CLIENT_ID) and MONIEPOINT_SECRET_KEY.",
    };
  }

  const cleanedAccount = accountNumber.replace(/\D/g, "");
  if (cleanedAccount.length !== 10) {
    return {
      success: false,
      error: "Invalid account number. Must be 10 digits.",
    };
  }

  const body = {
    accountNumber: cleanedAccount,
    bankCode: bankCode.trim(),
  };

  try {
    let authHeader: string;
    let validatePath: string;

    if (isMoniepointNative) {
      let token: string;
      try {
        token = await getMoniepointBearerToken();
      } catch (authErr: unknown) {
        const authMsg =
          authErr instanceof Error ? authErr.message : "Token request failed";
        const friendly =
          /no message available/i.test(authMsg)
            ? "Moniepoint auth endpoint returned an error. Your credentials may be for POS/terminal API (atm.moniepoint.com), which uses a different base URL. Try MONIEPOINT_BASE_URL from your Moniepoint docs, or use Monnify (app.monnify.com) keys with MONIEPOINT_BASE_URL left unset for bank verification."
            : `Moniepoint auth failed: ${authMsg}. Check MONIEPOINT_BASE_URL and credentials (Client ID + API Key from Moniepoint).`;
        console.error("[Moniepoint] Auth/token error:", authMsg);
        return {
          success: false,
          error: friendly,
        };
      }
      authHeader = `Bearer ${token}`;
      validatePath = "/disbursement/account/validate";
    } else {
      authHeader = getMonnifyBasicAuthHeader();
      validatePath = "/api/v1/disbursement/account/validate";
    }

    const base = effectiveBaseUrl.replace(/\/$/, "");
    const url = base + (validatePath.startsWith("/") ? validatePath : `/${validatePath}`);
    const response = await axios.post(url, body, {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    const data = response.data;
    const resBody = data.responseBody ?? data.data ?? data;
    const accountName = resBody.accountName ?? resBody.account_name;

    if (accountName) {
      return {
        success: true,
        data: {
          accountNumber:
            resBody.accountNumber ?? resBody.account_number ?? cleanedAccount,
          accountName: String(accountName).trim(),
        },
      };
    }

    return {
      success: false,
      error:
        data.responseMessage ?? data.message ?? "Account name not returned",
    };
  } catch (err: unknown) {
    const axiosError = err as AxiosError<{
      responseMessage?: string;
      message?: string;
    }>;
    const status = axiosError.response?.status;
    let message =
      axiosError.response?.data?.responseMessage ??
      axiosError.response?.data?.message ??
      (status === 401 ? "Invalid Moniepoint API credentials" : axiosError.message) ??
      "Failed to verify account";
    if (typeof message === "string" && (message.trim() === "" || /no message available/i.test(message))) {
      message = status === 401 ? "Invalid Moniepoint API credentials" : "Could not verify bank account. Check number and bank.";
    }
    if (status === 401 && !isMoniepointNative) {
      message =
        "Moniepoint credentials were rejected. You may be using Moniepoint (atm.moniepoint.com) keys while the app is calling Monnify. Set MONIEPOINT_BASE_URL=https://api.moniepoint.com/v1 in .env.local and restart the server.";
    }
    console.error(
      "[Moniepoint] Verify account error:",
      message,
      "status:",
      status,
      "url:",
      effectiveBaseUrl,
      "isMoniepointNative:",
      isMoniepointNative,
      "response:",
      axiosError.response?.data
    );
    return {
      success: false,
      error: message,
    };
  }
}
