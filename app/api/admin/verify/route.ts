import { NextRequest, NextResponse } from "next/server";
import { isAdminWallet, getAdminDetails } from "@/lib/supabase";
import { verifyMessage } from "viem";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, signature, message } = body;

    if (!walletAddress || !signature || !message) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify message signature
    try {
      const isValid = await verifyMessage({
        address: walletAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        return NextResponse.json(
          { success: false, error: "Invalid signature" },
          { status: 401 }
        );
      }
    } catch (verifyError) {
      console.error("Signature verification error:", verifyError);
      return NextResponse.json(
        { success: false, error: "Signature verification failed" },
        { status: 401 }
      );
    }

    // Check if wallet is admin and get details
    const normalizedAddress = walletAddress.toLowerCase().trim();
    console.log("Verifying admin wallet:", normalizedAddress);
    console.log("Environment ADMIN_WALLETS:", process.env.NEXT_PUBLIC_ADMIN_WALLETS);
    
    const adminDetails = await getAdminDetails(normalizedAddress);
    console.log("Admin details result:", adminDetails);

    if (!adminDetails.isAdmin) {
      return NextResponse.json(
        { 
          success: false, 
          isAdmin: false, 
          error: "Wallet is not authorized as admin",
          debug: {
            walletAddress: normalizedAddress,
            envWallets: process.env.NEXT_PUBLIC_ADMIN_WALLETS,
          }
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      isAdmin: true,
      walletAddress,
      role: adminDetails.role,
      permissions: adminDetails.permissions || [],
    });
  } catch (error: any) {
    console.error("Admin verification error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

