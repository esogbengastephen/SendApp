/**
 * Nigerian Bank Codes for Flutterwave Transfers
 * Bank codes are used in the account_bank field when creating transfers
 */

import axios from "axios";
import { getAccessToken, isV4Configured } from "./flutterwave-v4-token";

export interface NigerianBank {
  code: string;
  name: string;
}

// Flutterwave v4 API credentials (OAuth2)
const FLW_CLIENT_ID = process.env.FLW_CLIENT_ID || process.env.FLUTTERWAVE_CLIENT_ID;
const FLW_CLIENT_SECRET = process.env.FLW_CLIENT_SECRET || process.env.FLUTTERWAVE_CLIENT_SECRET;

// Flutterwave v3 API credentials (legacy)
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;

const FLUTTERWAVE_USE_TEST_MODE = process.env.FLUTTERWAVE_USE_TEST_MODE !== undefined
  ? process.env.FLUTTERWAVE_USE_TEST_MODE === "true"
  : process.env.NODE_ENV === "development";

// Determine which API version to use
const USE_V4_API = isV4Configured();

// API Base URLs
const FLUTTERWAVE_API_BASE = USE_V4_API
  ? (FLUTTERWAVE_USE_TEST_MODE 
      ? "https://developersandbox-api.flutterwave.com"
      : "https://f4bexperience.flutterwave.com")
  : (FLUTTERWAVE_USE_TEST_MODE 
      ? "https://developersandbox-api.flutterwave.com/v3"
      : "https://api.flutterwave.com/v3");

export const NIGERIAN_BANKS: NigerianBank[] = [
  // Traditional Commercial Banks
  { code: "044", name: "Access Bank" },
  { code: "063", name: "Access Bank (Diamond)" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "070", name: "Fidelity Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "214", name: "First City Monument Bank" },
  { code: "058", name: "Guaranty Trust Bank" },
  { code: "030", name: "Heritage Bank" },
  { code: "301", name: "Jaiz Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "526", name: "Parallex Bank" },
  { code: "076", name: "Polaris Bank" },
  { code: "101", name: "Providus Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "068", name: "Standard Chartered Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "100", name: "Suntrust Bank" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "033", name: "United Bank For Africa" },
  { code: "215", name: "Unity Bank" },
  { code: "035", name: "Wema Bank" },
  { code: "057", name: "Zenith Bank" },
  
  // Fintech & Digital Banks
  { code: "50211", name: "Kuda Bank" },
  { code: "100022", name: "OPay" },
  { code: "100023", name: "Palmpay" },
  { code: "100024", name: "Moniepoint" },
  { code: "100025", name: "Carbon" },
  { code: "100026", name: "FairMoney" },
  { code: "100027", name: "Rubies Bank" },
  { code: "100028", name: "Sparkle" },
  { code: "100029", name: "VBank" },
  { code: "100030", name: "Mint" },
  { code: "100031", name: "ALAT by Wema" },
  { code: "100032", name: "GoMoney" },
  { code: "100033", name: "PocketApp" },
  { code: "100034", name: "Cellulant" },
  { code: "100035", name: "Chipper Cash" },
  { code: "100036", name: "Paga" },
  { code: "100037", name: "Quickteller" },
  { code: "100038", name: "Nomba" },
  { code: "100039", name: "Smartcash PSB" },
  { code: "100040", name: "MoMo PSB" },
  
  // Microfinance & Other Banks
  { code: "090110", name: "AB Microfinance Bank" },
  { code: "090112", name: "Accion Microfinance Bank" },
  { code: "090117", name: "Baobab Microfinance Bank" },
  { code: "090160", name: "LAPO Microfinance Bank" },
  { code: "090175", name: "NPF Microfinance Bank" },
  { code: "090177", name: "Parallex Microfinance Bank" },
  { code: "090270", name: "Seed Capital Microfinance Bank" },
  { code: "090271", name: "Seedvest Microfinance Bank" },
  { code: "090405", name: "VFD Microfinance Bank" },
  
  // Payment Service Banks (PSB) & Fintech
  { code: "120001", name: "9PSB" },
  { code: "120002", name: "Airtel Smartcash PSB" },
  { code: "120003", name: "MTN Momo PSB" },
  { code: "120004", name: "Hope PSB" },
  { code: "120005", name: "MoneyMaster PSB" },
];

/**
 * Fetch banks from Flutterwave API (for NGN transfers)
 * This ensures we have the most up-to-date list including all fintech providers
 */
export async function fetchBanksFromFlutterwave(): Promise<NigerianBank[]> {
  try {
    // Get authentication header (v4 uses OAuth2 token, v3 uses secret key)
    let authHeader: string;
    if (USE_V4_API) {
      const accessToken = await getAccessToken();
      authHeader = `Bearer ${accessToken}`;
    } else {
      if (!FLUTTERWAVE_SECRET_KEY) {
        console.warn("[Nigerian Banks] Flutterwave credentials not configured, using static list");
        return NIGERIAN_BANKS;
      }
      authHeader = `Bearer ${FLUTTERWAVE_SECRET_KEY}`;
    }

    const response = await axios.get(
      `${FLUTTERWAVE_API_BASE}/banks/NG`,
      {
        headers: {
          Authorization: authHeader,
        },
      }
    );

    if (response.data.status === "success" && response.data.data) {
      // Flutterwave returns banks with code and name
      const banks = response.data.data
        .filter((bank: any) => bank.code && bank.name) // Filter out invalid entries
        .map((bank: any) => ({
          code: String(bank.code || bank.id || ""),
          name: bank.name,
        }))
        .filter((bank: NigerianBank) => bank.code && bank.name); // Final filter

      // Merge with static list, prioritizing API data (remove duplicates)
      const apiBankCodes = new Set(banks.map((b: NigerianBank) => b.code));
      const staticBanksNotInAPI = NIGERIAN_BANKS.filter(b => !apiBankCodes.has(b.code));
      
      // Combine and sort alphabetically
      const allBanks = [...banks, ...staticBanksNotInAPI].sort((a, b) => 
        a.name.localeCompare(b.name)
      );
      
      console.log(`[Nigerian Banks] Fetched ${banks.length} banks from Flutterwave API, ${staticBanksNotInAPI.length} from static list`);
      return allBanks;
    }

    return NIGERIAN_BANKS;
  } catch (error: any) {
    console.error("[Nigerian Banks] Error fetching from Flutterwave API:", error.message);
    // Return static list as fallback
    return NIGERIAN_BANKS;
  }
}

/**
 * Get bank by code
 */
export function getBankByCode(code: string): NigerianBank | undefined {
  return NIGERIAN_BANKS.find(bank => bank.code === code);
}

/**
 * Get bank by name (case-insensitive)
 */
export function getBankByName(name: string): NigerianBank | undefined {
  return NIGERIAN_BANKS.find(bank => 
    bank.name.toLowerCase().includes(name.toLowerCase()) ||
    name.toLowerCase().includes(bank.name.toLowerCase())
  );
}

/**
 * Validate bank account number (10 digits for most Nigerian banks)
 */
export function isValidBankAccountNumber(accountNumber: string): boolean {
  const cleaned = accountNumber.replace(/\D/g, "");
  // Most Nigerian bank accounts are 10 digits
  return cleaned.length === 10 && /^\d{10}$/.test(cleaned);
}

/**
 * Map Flutterwave bank names to bank codes
 * Flutterwave virtual accounts are typically issued by specific banks
 */
export function getBankCodeFromName(bankName: string): string | null {
  if (!bankName) return null;
  
  const nameLower = bankName.toLowerCase();
  
  // Common Flutterwave virtual account banks
  if (nameLower.includes("providus")) return "101";
  if (nameLower.includes("wema")) return "035";
  if (nameLower.includes("kuda")) return "50211"; // Kuda uses a different code
  if (nameLower.includes("flutterwave")) return "flutterwave"; // Special case
  
  // Try to match by bank name
  const bank = getBankByName(bankName);
  return bank?.code || null;
}

/**
 * Get bank code for Flutterwave transfers
 * For user-to-user transfers, we need to convert bank name to code
 */
export function getTransferBankCode(bankNameOrCode: string): string {
  // If it's already a 3-digit code, return it
  if (/^\d{3}$/.test(bankNameOrCode)) {
    return bankNameOrCode;
  }
  
  // Try to get code from name
  const code = getBankCodeFromName(bankNameOrCode);
  if (code) return code;
  
  // Default fallback - use Providus (common Flutterwave bank)
  return "101";
}
