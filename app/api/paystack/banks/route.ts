import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API_BASE = "https://api.paystack.co";

/**
 * Get list of Nigerian banks from Paystack
 * GET /api/paystack/banks
 */
export async function GET(request: NextRequest) {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "Paystack not configured",
        },
        { status: 500 }
      );
    }

    // Fetch banks from Paystack
    const response = await axios.get(
      `${PAYSTACK_API_BASE}/bank?country=nigeria`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (response.data.status) {
      // Map Paystack response to our format
      const banks = (response.data.data || []).map((bank: any) => ({
        name: bank.name,
        code: bank.code,
        slug: bank.slug || bank.name.toLowerCase().replace(/\s+/g, "-"),
      }));

      return NextResponse.json({
        success: true,
        banks: banks.sort((a: any, b: any) => a.name.localeCompare(b.name)), // Sort alphabetically
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: response.data.message || "Failed to fetch banks",
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("[Get Banks] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.response?.data?.message || "Failed to fetch banks",
      },
      { status: 500 }
    );
  }
}

