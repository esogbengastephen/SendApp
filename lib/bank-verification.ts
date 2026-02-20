/**
 * Bank account verification (name enquiry).
 * Order: NIBSS (if set) → Flutterwave → Paystack fallback (so OPay, Palmpay, etc. work when Flutterwave fails).
 */

import { verifyBankAccountViaNibss, isNibssConfigured } from "./nibss-verify";
import { verifyBankAccount as verifyBankAccountFlutterwave } from "./flutterwave";
import { resolveBankAccount as resolveBankAccountPaystack, isPaystackResolveConfigured } from "./paystack";

export type VerifyBankAccountResult =
  | { success: true; data: { accountName: string; accountNumber: string }; provider?: "nibss" | "flutterwave" | "paystack" }
  | { success: false; error: string; details?: unknown; isTestMode?: boolean };

const LIVE_HINT =
  " For live verification of OPay and all banks, set NIBSS_NAME_ENQUIRY_URL (NIBSS) or use Flutterwave production (FLUTTERWAVE_USE_TEST_MODE=false).";

/** User-friendly message when provider returns a connection/availability error */
const CONNECTION_ERROR_MESSAGE =
  "Bank verification is temporarily unavailable. Please check your account number and bank, then try again.";

function addLiveHint(error: string, isTestMode?: boolean): string {
  if (!isTestMode) return error;
  if (/test mode|Access Bank|044|sandbox/i.test(error) && !error.includes("NIBSS_NAME_ENQUIRY")) {
    return error + LIVE_HINT;
  }
  return error;
}

function normalizeProviderError(error: string): string {
  if (!error || typeof error !== "string") return "Verification failed. Please try again.";
  const lower = error.toLowerCase();
  if (lower.includes("could not connect") || lower.includes("couldn't connect") || lower.includes("connect to your bank") || lower.includes("temporarily unavailable") || lower.includes("connection")) {
    return CONNECTION_ERROR_MESSAGE;
  }
  return error;
}

/**
 * Verify a Nigerian bank account and return the account holder name.
 * When NIBSS_NAME_ENQUIRY_URL is set, uses NIBSS first (live verification for all banks including OPay).
 * Otherwise uses Flutterwave, then Paystack fallback (pass bankName so OPay resolves via Paystack when Flutterwave fails).
 */
export async function verifyBankAccount(
  accountNumber: string,
  bankCode: string,
  options?: { bankName?: string }
): Promise<VerifyBankAccountResult> {
  if (isNibssConfigured()) {
    const nibssResult = await verifyBankAccountViaNibss(accountNumber, bankCode);
    if (nibssResult.success) {
      return { ...nibssResult, provider: "nibss" };
    }
    // Fall back to Flutterwave, then Paystack if both fail
    const flw = await verifyBankAccountFlutterwave(accountNumber, bankCode);
    if (flw.success && flw.data) {
      return { success: true, data: flw.data, provider: "flutterwave" };
    }
    if (isPaystackResolveConfigured()) {
      console.log("[Bank Verification] NIBSS+Flutterwave failed, trying Paystack for", accountNumber, "bank", bankCode);
      const paystack = await resolveBankAccountPaystack(accountNumber, bankCode);
      if (paystack.success && paystack.data) {
        console.log("[Bank Verification] Paystack resolved:", paystack.data.accountName);
        return { success: true, data: paystack.data, provider: "paystack" };
      }
      console.log("[Bank Verification] Paystack fallback failed:", !paystack.success && "error" in paystack ? paystack.error : "unknown");
    }
    const err = addLiveHint(flw.error || nibssResult.error, (flw as any).isTestMode);
    return {
      success: false,
      error: normalizeProviderError(err),
      details: (flw as any).details,
      isTestMode: (flw as any).isTestMode,
    };
  }
  const flw = await verifyBankAccountFlutterwave(accountNumber, bankCode);
  if (flw.success && flw.data) {
    return { success: true, data: flw.data, provider: "flutterwave" };
  }
  if (isPaystackResolveConfigured()) {
    console.log("[Bank Verification] Flutterwave failed, trying Paystack fallback for", accountNumber, "bank", bankCode);
    const paystack = await resolveBankAccountPaystack(accountNumber, bankCode, { bankName: options?.bankName });
    if (paystack.success && paystack.data) {
      console.log("[Bank Verification] Paystack resolved:", paystack.data.accountName);
      return { success: true, data: paystack.data, provider: "paystack" };
    }
    console.log("[Bank Verification] Paystack fallback failed:", !paystack.success && "error" in paystack ? paystack.error : "unknown");
  }
  const err = addLiveHint(flw.error || "Verification failed", (flw as any).isTestMode);
  return {
    success: false,
    error: normalizeProviderError(err),
    details: (flw as any).details,
    isTestMode: (flw as any).isTestMode,
  };
}
