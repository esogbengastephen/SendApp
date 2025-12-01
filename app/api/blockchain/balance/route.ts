import { NextRequest, NextResponse } from "next/server";
import { getTokenBalance } from "@/lib/blockchain";
import { isValidAddress } from "@/utils/validation";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { success: false, error: "Address is required" },
        { status: 400 }
      );
    }

    // Validate address format
    if (!isValidAddress(address)) {
      return NextResponse.json(
        { success: false, error: "Invalid wallet address format" },
        { status: 400 }
      );
    }

    // Get token balance
    const balance = await getTokenBalance(address);

    return NextResponse.json({
      success: true,
      address,
      balance,
      token: "SEND",
    });
  } catch (error: any) {
    console.error("Error fetching token balance:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch balance" },
      { status: 500 }
    );
  }
}

