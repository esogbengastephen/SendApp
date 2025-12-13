import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API_BASE = "https://api.paystack.co";

/**
 * Resolve bank account number to get account name
 * GET /api/paystack/resolve-account?accountNumber=xxx&bankName=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const accountNumber = searchParams.get("accountNumber");
    const bankName = searchParams.get("bankName");

    if (!accountNumber || !bankName) {
      return NextResponse.json(
        {
          success: false,
          error: "Account number and bank name are required",
        },
        { status: 400 }
      );
    }

    if (!PAYSTACK_SECRET_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "Paystack not configured",
        },
        { status: 500 }
      );
    }

    // First, fetch banks from Paystack to get bank code
    let bankCode: string | null = null;
    try {
      const banksResponse = await axios.get(
        `${PAYSTACK_API_BASE}/bank?country=nigeria`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      if (banksResponse.data.status) {
        const banks = banksResponse.data.data || [];
        const bank = banks.find(
          (b: any) => b.name.toLowerCase() === bankName.toLowerCase()
        );
        if (bank) {
          bankCode = bank.code;
        }
      }
    } catch (error) {
      console.error("[Resolve Account] Error fetching banks:", error);
    }

    if (!bankCode) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid bank name",
        },
        { status: 400 }
      );
    }

    if (!PAYSTACK_SECRET_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "Paystack not configured",
        },
        { status: 500 }
      );
    }

    // Call Paystack resolve API
    const response = await axios.get(
      `${PAYSTACK_API_BASE}/bank/resolve`,
      {
        params: {
          account_number: accountNumber,
          bank_code: bankCode,
        },
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (response.data.status) {
      return NextResponse.json({
        success: true,
        accountName: response.data.data.account_name,
        accountNumber: response.data.data.account_number,
        bankCode: bankCode,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: response.data.message || "Failed to resolve account",
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("[Resolve Account] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.response?.data?.message || "Failed to resolve account",
      },
      { status: 500 }
    );
  }
}

