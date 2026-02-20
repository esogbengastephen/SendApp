/**
 * NIBSS-based bank account verification (Name Enquiry).
 * Use when you have access to a NIBSS Name Enquiry API (direct or via a gateway).
 *
 * Set in .env:
 *   NIBSS_NAME_ENQUIRY_URL - Full URL of the name enquiry endpoint (e.g. from NIBSS gateway or partner)
 *   NIBSS_API_KEY          - Optional. Bearer or API key if required by the gateway
 *
 * Expected request: POST with JSON { account_number, bank_code } or { accountNumber, bankCode }
 * Expected response: 200 with JSON containing account name, e.g.:
 *   { account_name: "NAME" } or { accountName: "NAME" } or { data: { account_name: "NAME" } }
 */

import axios, { AxiosError } from "axios";

const NIBSS_URL = process.env.NIBSS_NAME_ENQUIRY_URL?.trim();
const NIBSS_API_KEY = process.env.NIBSS_API_KEY?.trim();

export function isNibssConfigured(): boolean {
  return !!NIBSS_URL && NIBSS_URL.length > 5;
}

/**
 * Verify bank account via NIBSS Name Enquiry.
 * Returns account holder name on success.
 */
export async function verifyBankAccountViaNibss(
  accountNumber: string,
  bankCode: string
): Promise<{ success: true; data: { accountName: string; accountNumber: string } } | { success: false; error: string }> {
  if (!isNibssConfigured()) {
    return { success: false, error: "NIBSS name enquiry URL not configured" };
  }

  const cleanedAccount = accountNumber.replace(/\D/g, "").slice(0, 10);
  const cleanedBank = String(bankCode ?? "").trim();
  if (cleanedAccount.length !== 10) {
    return { success: false, error: "Invalid account number. Must be 10 digits." };
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (NIBSS_API_KEY) {
      headers["Authorization"] = NIBSS_API_KEY.startsWith("Bearer ") ? NIBSS_API_KEY : `Bearer ${NIBSS_API_KEY}`;
    }

    const body = { account_number: cleanedAccount, account_bank: cleanedBank };

    const response = await axios.post(NIBSS_URL!, body, {
      headers,
      timeout: 15000,
      validateStatus: () => true,
    });

    const data = response.data;
    const status = response.status;

    if (status !== 200) {
      const msg = data?.message || data?.error || `HTTP ${status}`;
      return { success: false, error: msg };
    }

    // Accept common response shapes
    let accountName: string | null =
      data?.account_name ?? data?.accountName ?? data?.data?.account_name ?? data?.data?.accountName ?? null;
    if (accountName && typeof accountName === "string") {
      accountName = accountName.trim();
    }
    if (!accountName) {
      return {
        success: false,
        error: data?.message || "Account verified but name not returned",
      };
    }

    return {
      success: true,
      data: {
        accountName,
        accountNumber: data?.account_number ?? data?.accountNumber ?? cleanedAccount,
      },
    };
  } catch (err) {
    const axiosErr = err as AxiosError<{ message?: string; error?: string }>;
    const message =
      axiosErr.response?.data?.message ??
      axiosErr.response?.data?.error ??
      (axiosErr.message && axiosErr.message.length < 200 ? axiosErr.message : "NIBSS verification failed");
    return { success: false, error: message };
  }
}
