import { NextRequest, NextResponse } from "next/server";
import { isAdminWallet } from "@/lib/supabase";
import { getWalletClient, getTokenBalance } from "@/lib/blockchain";
import { SEND_TOKEN_ADDRESS, BASE_RPC_URL } from "@/lib/constants";

/**
 * Verify liquidity pool configuration and balance
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

    // Get liquidity pool address
    const walletClient = getWalletClient();
    const poolAddress = walletClient.account.address;

    // Get balance
    let balance = "0";
    let balanceError = null;
    try {
      balance = await getTokenBalance(poolAddress);
    } catch (error: any) {
      balanceError = error.message;
    }

    return NextResponse.json({
      success: true,
      data: {
        poolAddress,
        balance,
        balanceError,
        tokenContract: SEND_TOKEN_ADDRESS,
        rpcUrl: BASE_RPC_URL,
        network: "Base",
        // Verification info
        privateKeySet: !!process.env.LIQUIDITY_POOL_PRIVATE_KEY,
        privateKeyLength: process.env.LIQUIDITY_POOL_PRIVATE_KEY?.length || 0,
      },
    });
  } catch (error: any) {
    console.error("Error verifying pool:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

