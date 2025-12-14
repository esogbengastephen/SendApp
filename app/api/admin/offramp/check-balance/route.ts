import { NextRequest, NextResponse } from "next/server";
import { isAdminWallet } from "@/lib/supabase";
import { createPublicClient, http, formatEther } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL } from "@/lib/constants";

/**
 * Check wallet balance directly (Admin only) - for debugging
 * POST /api/admin/offramp/check-balance
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminWallet, walletAddress } = body;

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

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: "Wallet address is required" },
        { status: 400 }
      );
    }

    // Create public client
    const publicClient = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    // Check ETH balance using the provided address directly
    const addressToCheck = walletAddress.toLowerCase() as `0x${string}`;
    
    console.log(`[Check Balance] Checking balance for: ${addressToCheck}`);
    console.log(`[Check Balance] Using RPC: ${BASE_RPC_URL}`);
    
    const ethBalance = await publicClient.getBalance({
      address: addressToCheck,
    });

    const balanceFormatted = formatEther(ethBalance);

    // Also check latest block to verify RPC is working
    const latestBlock = await publicClient.getBlockNumber();
    
    // Get block info to verify chain
    const block = await publicClient.getBlock({ blockNumber: latestBlock });

    return NextResponse.json({
      success: true,
      walletAddress: addressToCheck,
      balance: balanceFormatted,
      balanceWei: ethBalance.toString(),
      rpcUrl: BASE_RPC_URL,
      latestBlock: latestBlock.toString(),
      blockHash: block.hash,
      chainId: base.id,
      chainName: base.name,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Check Balance] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
        details: error.stack,
        rpcUrl: BASE_RPC_URL,
      },
      { status: 500 }
    );
  }
}

