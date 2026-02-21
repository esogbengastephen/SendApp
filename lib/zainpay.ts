/**
 * Zainpay NGN transfer gateway for off-ramp payouts.
 * Docs: https://zainpay.ng/developers/api-endpoints?section=funds-transfer (POST bank/transfer/v2)
 */

// The Public Key JWT is the correct bearer token for all ZainPay API calls.
// Secret Key is NOT used as a bearer token — the JWT is.
const ZAINPAY_PUBLIC_KEY = process.env.ZAINPAY_PUBLIC_KEY?.trim();
const ZAINPAY_API_TOKEN = ZAINPAY_PUBLIC_KEY;
const ZAINPAY_SANDBOX = process.env.ZAINPAY_SANDBOX === "true" || process.env.ZAINPAY_SANDBOX === "1";
const ZAINPAY_BASE_RAW = process.env.ZAINPAY_BASE_URL?.trim() || (ZAINPAY_SANDBOX ? "https://sandbox.zainpay.ng/" : "https://api.zainpay.ng/");
const ZAINPAY_BASE = ZAINPAY_BASE_RAW.replace(/\/?$/, "/");
const ZAINPAY_ZAINBOX_CODE = process.env.ZAINPAY_ZAINBOX_CODE?.trim();
const ZAINPAY_SOURCE_ACCOUNT = process.env.ZAINPAY_SOURCE_ACCOUNT_NUMBER?.trim();
const ZAINPAY_SOURCE_BANK_CODE = process.env.ZAINPAY_SOURCE_BANK_CODE?.trim();
const ZAINPAY_CALLBACK_URL = process.env.ZAINPAY_CALLBACK_URL?.trim();

/** Cached Zainpay bank list: { code, name }[] */
let zainpayBankListCache: { code: string; name: string }[] | null = null;
let zainpayBankListCacheTime = 0;
const ZAINPAY_BANK_LIST_CACHE_MS = 10 * 60 * 1000;

/**
 * Fetch Zainpay's bank list. Use for resolving our bank code (e.g. 058) to Zainpay's code.
 * Docs: https://zainpay.ng/developers/api-endpoints — Get Bank List GET bank/list
 */
export async function getBankList(): Promise<{
  success: boolean;
  data?: { code: string; name: string }[];
  error?: string;
}> {
  if (!ZAINPAY_PUBLIC_KEY) {
    return { success: false, error: "Zainpay not configured" };
  }
  try {
    const res = await fetch(`${ZAINPAY_BASE}bank/list`, {
      method: "GET",
      headers: { Authorization: `Bearer ${ZAINPAY_API_TOKEN}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: json?.description ?? json?.message ?? "Failed to get bank list" };
    }
    const list = Array.isArray(json?.data) ? json.data : [];
    const banks = list
      .map((b: { code?: string; name?: string }) => ({ code: String(b?.code ?? "").trim(), name: String(b?.name ?? "").trim() }))
      .filter((b: { code: string; name: string }) => b.code && b.name);
    return { success: true, data: banks };
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    return { success: false, error: err };
  }
}

/**
 * Resolve Nigerian bank code (e.g. 058 for GTBank) to Zainpay's bank code.
 * Fetches Zainpay bank list and matches by bank name from our static list.
 */
export async function getZainpayBankCode(nigerianCode: string): Promise<string> {
  const code = String(nigerianCode ?? "").trim();
  if (!code) return code;
  if (zainpayBankListCache && Date.now() - zainpayBankListCacheTime < ZAINPAY_BANK_LIST_CACHE_MS) {
    const found = findZainpayCodeByNigerianCode(code, zainpayBankListCache);
    if (found) return found;
    return code;
  }
  const res = await getBankList();
  if (res.success && res.data) {
    zainpayBankListCache = res.data;
    zainpayBankListCacheTime = Date.now();
    const found = findZainpayCodeByNigerianCode(code, res.data);
    if (found) return found;
  }
  return code;
}

function findZainpayCodeByNigerianCode(nigerianCode: string, zainpayBanks: { code: string; name: string }[]): string | null {
  try {
    const { getBankByCode } = require("./nigerian-banks");
    const bank = getBankByCode(nigerianCode);
    const ourName = bank?.name?.toLowerCase() ?? "";
    if (!ourName) return null;
    const match = zainpayBanks.find((b) => {
      const n = (b.name || "").toLowerCase();
      return n.includes(ourName) || ourName.includes(n) || (n.includes("guaranty trust") && ourName.includes("guaranty"));
    });
    if (match) return match.code;
    if (ourName.includes("guaranty") || ourName.includes("gtb")) {
      const gtb = zainpayBanks.find((b) => /gtb|guaranty|058/i.test((b.name || "") + b.code));
      if (gtb) return gtb.code;
    }
  } catch {
    // ignore
  }
  return null;
}

export interface ZainpayTransferParams {
  accountBank: string;
  accountNumber: string;
  amount: number;
  currency?: string;
  narration?: string;
  reference?: string;
}

/**
 * Initiate NGN bank transfer via Zainpay.
 * Amount is in Naira; Zainpay expects kobo (amount * 100) in the API.
 */
export async function createTransfer(params: ZainpayTransferParams): Promise<{
  success: boolean;
  data?: unknown;
  error?: string;
  details?: unknown;
}> {
  if (!ZAINPAY_PUBLIC_KEY || !ZAINPAY_ZAINBOX_CODE || !ZAINPAY_SOURCE_ACCOUNT || !ZAINPAY_SOURCE_BANK_CODE) {
    return {
      success: false,
      error:
        "Zainpay not configured. Set ZAINPAY_PUBLIC_KEY, ZAINPAY_ZAINBOX_CODE, ZAINPAY_SOURCE_ACCOUNT_NUMBER, ZAINPAY_SOURCE_BANK_CODE.",
    };
  }

  const amountNgn = Math.round(Number(params.amount)) || 0;
  if (amountNgn <= 0) {
    return { success: false, error: "Invalid transfer amount" };
  }

  const amountKobo = amountNgn * 100;
  const reference = params.reference || `OFFRAMP-${Date.now()}`;
  const destinationBankCode = await getZainpayBankCode(String(params.accountBank).trim());

  const payload: Record<string, string> = {
    destinationAccountNumber: String(params.accountNumber).replace(/\D/g, "").slice(0, 10),
    destinationBankCode,
    amount: String(amountKobo),
    sourceAccountNumber: ZAINPAY_SOURCE_ACCOUNT,
    sourceBankCode: ZAINPAY_SOURCE_BANK_CODE,
    zainboxCode: ZAINPAY_ZAINBOX_CODE,
    txnRef: reference,
    narration: params.narration || "SEND off-ramp payout",
  };
  if (ZAINPAY_CALLBACK_URL) payload.callbackUrl = ZAINPAY_CALLBACK_URL;

  try {
    const transferPath = "bank/transfer/v2";
    const res = await fetch(`${ZAINPAY_BASE}${transferPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ZAINPAY_API_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    const code = data?.code ?? data?.status;
    const ok = res.ok && (code === "00" || code === "200 OK" || data?.status === "Success" || data?.status === "200 OK");

    if (ok) {
      return { success: true, data: data?.data ?? data };
    }

    const message = data?.description ?? data?.message ?? data?.error ?? (res.statusText || "Transfer failed");
    return {
      success: false,
      error: typeof message === "string" ? message : "Transfer failed",
      details: { ...data, _httpStatus: res.status, _url: `${ZAINPAY_BASE}${transferPath}` },
    };
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[Zainpay Transfer] Error:", err);
    return { success: false, error: err };
  }
}

/**
 * Create a ZainPay dynamic virtual account per transaction for on-ramp payments.
 * No BVN required. Each call generates a fresh one-time virtual account.
 * Docs: https://zainpay.ng/developers/api-endpoints?section=create-dynamic-virtual-account
 * Endpoint: POST virtual-account/dynamic/create/request
 */
export interface CreateDynamicVirtualAccountParams {
  firstName: string;
  surname: string;
  email: string;
  mobileNumber: string;
  amount: number;
  txnRef: string;
}

export async function createDynamicVirtualAccount(params: CreateDynamicVirtualAccountParams): Promise<{
  success: boolean;
  data?: { accountNumber: string; bankName: string; accountName: string };
  error?: string;
  details?: unknown;
}> {
  if (!ZAINPAY_API_TOKEN || !ZAINPAY_ZAINBOX_CODE) {
    return {
      success: false,
      error: "Zainpay not configured. Set ZAINPAY_PUBLIC_KEY and ZAINPAY_ZAINBOX_CODE.",
    };
  }

  const mobile = String(params.mobileNumber ?? "").replace(/\D/g, "").slice(0, 11) || "08000000000";
  const firstName = String(params.firstName ?? "").trim() || "Customer";
  const surname = String(params.surname ?? "").trim() || "FlipPay";
  const amountKobo = String(Math.round(params.amount * 100));

  const payload = {
    firstName,
    surname,
    email: String(params.email ?? "").trim(),
    mobileNumber: mobile,
    zainboxCode: ZAINPAY_ZAINBOX_CODE,
    txnRef: params.txnRef,
    amount: amountKobo,
    ...(ZAINPAY_CALLBACK_URL ? { callbackUrl: ZAINPAY_CALLBACK_URL } : {}),
  };

  const path = "virtual-account/dynamic/create/request";
  console.log(`[Zainpay Dynamic VA] POST ${ZAINPAY_BASE}${path} (sandbox: ${ZAINPAY_SANDBOX})`, JSON.stringify({ ...payload, amount: `${amountKobo} kobo` }));

  try {
    const res = await fetch(`${ZAINPAY_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ZAINPAY_API_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    const code = String(data?.code ?? "").trim();
    const ok = res.ok && (code === "00" || data?.status === "200 OK" || data?.status === "Success");

    console.log(`[Zainpay Dynamic VA] Response: HTTP ${res.status}, code=${code}`, JSON.stringify(data));

    if (ok && data?.data) {
      const d = data.data as { accountNumber?: string; bankName?: string; accountName?: string };
      return {
        success: true,
        data: {
          accountNumber: String(d?.accountNumber ?? ""),
          bankName: String(d?.bankName ?? "Wema Bank"),
          accountName: String(d?.accountName ?? `${firstName} ${surname}`),
        },
      };
    }

    const message = data?.description ?? data?.message ?? data?.error ?? (res.statusText || "Create failed");
    console.error("[Zainpay Dynamic VA] Failed:", JSON.stringify({ status: res.status, code, data }));
    return {
      success: false,
      error: typeof message === "string" ? message : "Create virtual account failed",
      details: data,
    };
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[Zainpay Dynamic VA] Error:", err);
    return { success: false, error: err };
  }
}

/**
 * Create a static virtual account linked to your Zainbox.
 * Use this account as the transfer source (ZAINPAY_SOURCE_ACCOUNT_NUMBER, ZAINPAY_SOURCE_BANK_CODE).
 * Docs: https://zainpay.ng/developers — Create Virtual Account POST virtual-account/create/request
 * bankType: "gtBank" | "fidelity" | "fcmb"
 */
export interface CreateStaticVirtualAccountParams {
  bankType: "gtBank" | "fidelity" | "fcmb";
  firstName: string;
  surname: string;
  email: string;
  mobileNumber: string;
  dob: string;
  gender: "M" | "F";
  address: string;
  title: string;
  state: string;
  bvn: string;
}

export async function createStaticVirtualAccount(params: CreateStaticVirtualAccountParams): Promise<{
  success: boolean;
  data?: { accountNumber: string; bankName: string; accountName: string; email?: string };
  error?: string;
  details?: unknown;
}> {
  if (!ZAINPAY_PUBLIC_KEY || !ZAINPAY_ZAINBOX_CODE) {
    return {
      success: false,
      error: "Zainpay not configured. Set ZAINPAY_PUBLIC_KEY and ZAINPAY_ZAINBOX_CODE.",
    };
  }
  const payload = {
    bankType: params.bankType,
    firstName: String(params.firstName).trim(),
    surname: String(params.surname).trim(),
    email: String(params.email).trim(),
    mobileNumber: String(params.mobileNumber).replace(/\D/g, "").slice(0, 11),
    dob: String(params.dob).trim(),
    gender: params.gender,
    address: String(params.address).trim(),
    title: String(params.title).trim(),
    state: String(params.state).trim(),
    bvn: String(params.bvn).replace(/\D/g, "").slice(0, 11),
    zainboxCode: ZAINPAY_ZAINBOX_CODE,
  };
  try {
    const path = "virtual-account/create/request";
    const res = await fetch(`${ZAINPAY_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ZAINPAY_API_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    const code = data?.code ?? data?.status;
    const ok = res.ok && (code === "00" || code === "200 OK" || data?.status === "200 OK");
    if (ok && data?.data) {
      const d = data.data as { accountNumber?: string; bankName?: string; accountName?: string; email?: string };
      return {
        success: true,
        data: {
          accountNumber: String(d?.accountNumber ?? ""),
          bankName: String(d?.bankName ?? ""),
          accountName: String(d?.accountName ?? ""),
          email: d?.email,
        },
      };
    }
    const message = data?.description ?? data?.message ?? data?.error ?? (res.statusText || "Create failed");
    return {
      success: false,
      error: typeof message === "string" ? message : "Create failed",
      details: data,
    };
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[Zainpay Create VA] Error:", err);
    return { success: false, error: err };
  }
}

/**
 * Get virtual account balance (for the static VA used as transfer source).
 * GET virtual-account/wallet/balance/{accountNumber}
 */
export async function getVirtualAccountBalance(accountNumber: string): Promise<{
  success: boolean;
  data?: { accountNumber: string; accountName?: string; balanceAmount?: number };
  error?: string;
}> {
  if (!ZAINPAY_PUBLIC_KEY) {
    return { success: false, error: "Zainpay not configured" };
  }
  const account = String(accountNumber).replace(/\D/g, "").trim();
  if (!account) return { success: false, error: "Account number required" };
  try {
    const res = await fetch(`${ZAINPAY_BASE}virtual-account/wallet/balance/${account}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${ZAINPAY_API_TOKEN}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data?.description ?? data?.message ?? "Failed to get balance" };
    }
    const d = data?.data as { accountNumber?: string; accountName?: string; balanceAmount?: number };
    return {
      success: true,
      data: {
        accountNumber: String(d?.accountNumber ?? account),
        accountName: d?.accountName,
        balanceAmount: Number(d?.balanceAmount ?? 0),
      },
    };
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    return { success: false, error: err };
  }
}

/**
 * Resolve Zainpay bank type (e.g. gtBank) to Zainpay bank code for use as sourceBankCode in transfers.
 */
export async function getZainpayBankCodeFromBankType(bankType: string): Promise<string> {
  const listRes = await getBankList();
  if (!listRes.success || !listRes.data) return "";
  const t = (bankType || "").toLowerCase();
  const match = listRes.data.find((b) => {
    const n = (b.name || "").toLowerCase();
    if (t === "gtbank") return /gt|guaranty/i.test(n);
    if (t === "fidelity") return n.includes("fidelity");
    if (t === "fcmb") return n.includes("fcmb") || n.includes("first city");
    return false;
  });
  return match?.code ?? "";
}

/**
 * Get NGN balance for the Zainbox/source account.
 * When ZAINPAY_SOURCE_ACCOUNT_NUMBER is set, uses the static virtual account balance;
 * otherwise tries Zainbox profile.
 */
export async function getAccountBalance(): Promise<{
  success: boolean;
  data?: { available_balance?: number; balance?: number };
  error?: string;
}> {
  if (!ZAINPAY_PUBLIC_KEY) {
    return { success: false, error: "Zainpay not configured" };
  }
  if (ZAINPAY_SOURCE_ACCOUNT) {
    const va = await getVirtualAccountBalance(ZAINPAY_SOURCE_ACCOUNT);
    if (va.success && va.data) {
      const bal = Number(va.data.balanceAmount ?? 0) || 0;
      return { success: true, data: { available_balance: bal, balance: bal } };
    }
    return { success: false, error: va.error ?? "Failed to get VA balance" };
  }
  if (!ZAINPAY_ZAINBOX_CODE) {
    return { success: false, error: "Zainpay not configured (ZAINBOX_CODE or SOURCE_ACCOUNT required)" };
  }
  try {
    const res = await fetch(`${ZAINPAY_BASE}zainbox/profile/${ZAINPAY_ZAINBOX_CODE}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${ZAINPAY_API_TOKEN}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data?.description ?? data?.message ?? "Failed to get balance" };
    }
    const balance = Number((data?.data as { balance?: number })?.balance ?? 0) || 0;
    return { success: true, data: { available_balance: balance, balance } };
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    return { success: false, error: err };
  }
}
