import { NextRequest, NextResponse } from "next/server";
import { getWalletClient, getTokenBalance } from "@/lib/blockchain";
import { isAdminWallet } from "@/lib/supabase";

/**
 * Get liquidity pool address and balance
 * Requires admin authentication
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const adminWallet = searchParams.get("adminWallet");

    // Verify admin access
    if (!adminWallet) {
      return NextResponse.json(
        { success: false, error: "Admin wallet address required" },
        { status: 400 }
      );
    }

    const isAdmin = await isAdminWallet(adminWallet);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    // Get liquidity pool address from private key
    const walletClient = getWalletClient();
    const poolAddress = walletClient.account.address;
    
    // Get balance
    let balance = "0";
    try {
      balance = await getTokenBalance(poolAddress);
      console.log(`[Pool Balance] Pool address: ${poolAddress}, Balance: ${balance} SEND`);
    } catch (error: any) {
      console.error("[Pool Balance] Error getting balance:", error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Failed to fetch pool balance",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      poolAddress,
      balance,
    });
  } catch (error: any) {
    console.error("[Pool Balance] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch pool balance",
      },
      { status: 500 }
    );
  }
}

