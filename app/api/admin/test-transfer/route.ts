import { NextRequest, NextResponse } from "next/server";
import { isAdminWallet } from "@/lib/supabase";
import { transferTokens, getTokenBalance, getWalletClient } from "@/lib/blockchain";

/**
 * Test endpoint to transfer tokens directly from liquidity pool
 * This is for testing purposes only
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, amount, adminWallet } = body;

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

    // Validate inputs
    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/i.test(walletAddress)) {
      return NextResponse.json(
        { success: false, error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid amount. Must be greater than 0" },
        { status: 400 }
      );
    }

    // Get liquidity pool address and balance
    const walletClient = getWalletClient();
    const poolAddress = walletClient.account.address;
    const poolBalance = await getTokenBalance(poolAddress);

    console.log(`[Test Transfer] Liquidity Pool Address: ${poolAddress}`);
    console.log(`[Test Transfer] Pool Balance: ${poolBalance} SEND`);
    console.log(`[Test Transfer] Transferring ${amount} SEND to ${walletAddress}`);

    // Transfer tokens
    const result = await transferTokens(walletAddress, amount);

    if (result.success) {
      // Get recipient balance after transfer
      const recipientBalance = await getTokenBalance(walletAddress);

      return NextResponse.json({
        success: true,
        message: "Tokens transferred successfully",
        data: {
          txHash: result.hash,
          from: poolAddress,
          to: walletAddress,
          amount: amount,
          poolBalanceBefore: poolBalance,
          recipientBalanceAfter: recipientBalance,
          explorerUrl: `https://basescan.org/tx/${result.hash}`,
        },
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Token transfer failed" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Test transfer error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Check liquidity pool balance
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

    // Get liquidity pool address and balance
    const walletClient = getWalletClient();
    const poolAddress = walletClient.account.address;
    
    console.log(`[Test Transfer] Checking balance for pool address: ${poolAddress}`);
    console.log(`[Test Transfer] Token contract: ${process.env.NEXT_PUBLIC_SEND_TOKEN_ADDRESS || "0xEab49138BA2Ea6dd776220fE26b7b8E446638956"}`);
    
    let poolBalance;
    try {
      poolBalance = await getTokenBalance(poolAddress);
      console.log(`[Test Transfer] Balance retrieved: ${poolBalance} SEND`);
    } catch (error: any) {
      console.error(`[Test Transfer] Error getting balance:`, error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: {
        poolAddress,
        balance: poolBalance,
        token: "SEND",
        tokenContract: process.env.NEXT_PUBLIC_SEND_TOKEN_ADDRESS || "0xEab49138BA2Ea6dd776220fE26b7b8E446638956",
        network: "Base",
      },
    });
  } catch (error: any) {
    console.error("Error checking pool balance:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

