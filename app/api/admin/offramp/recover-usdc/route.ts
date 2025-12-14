import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminWallet } from "@/lib/supabase";
import { generateUserOfframpWallet, getReceiverWalletAddress } from "@/lib/offramp-wallet";
import { USDC_BASE_ADDRESS } from "@/lib/0x-swap";
import { BASE_RPC_URL } from "@/lib/constants";

/**
 * Recover USDC from a unique wallet address
 * POST /api/admin/offramp/recover-usdc
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminWallet, walletAddress, transactionId } = body;

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

    // Find transaction by wallet address or transaction ID
    let transaction;
    if (transactionId) {
      const { data, error } = await supabaseAdmin
        .from("offramp_transactions")
        .select("*")
        .eq("transaction_id", transactionId)
        .single();
      
      if (error || !data) {
        return NextResponse.json(
          { success: false, error: "Transaction not found" },
          { status: 404 }
        );
      }
      transaction = data;
    } else if (walletAddress) {
      const { data, error } = await supabaseAdmin
        .from("offramp_transactions")
        .select("*")
        .eq("unique_wallet_address", walletAddress.toLowerCase())
        .single();
      
      if (error || !data) {
        return NextResponse.json(
          { success: false, error: "Transaction not found for this wallet address" },
          { status: 404 }
        );
      }
      transaction = data;
    } else {
      return NextResponse.json(
        { success: false, error: "Either walletAddress or transactionId is required" },
        { status: 400 }
      );
    }

    const targetWalletAddress = walletAddress || transaction.unique_wallet_address;

    // Generate wallet from user identifier to get private key
    // Use user_id if available, otherwise use user_email, or fallback to account number
    const userIdentifier = transaction.user_id || transaction.user_email || `guest_${transaction.user_account_number}`;
    const wallet = generateUserOfframpWallet(userIdentifier);
    
    // Verify wallet address matches
    if (wallet.address.toLowerCase() !== targetWalletAddress.toLowerCase()) {
      console.warn(`[Recover USDC] Wallet address mismatch! Generated: ${wallet.address}, Transaction: ${targetWalletAddress}`);
      // Try to use the transaction's wallet address directly if we have it
      // This handles edge cases where wallet was generated with old system
      if (targetWalletAddress.toLowerCase() !== transaction.unique_wallet_address.toLowerCase()) {
        return NextResponse.json(
          { success: false, error: "Wallet address mismatch. Cannot recover." },
          { status: 400 }
        );
      }
    }

    // Create clients
    const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    const publicClient = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    // Check USDC balance
    const usdcBalance = await publicClient.readContract({
      address: USDC_BASE_ADDRESS as `0x${string}`,
      abi: [
        {
          constant: true,
          inputs: [{ name: "_owner", type: "address" }],
          name: "balanceOf",
          outputs: [{ name: "", type: "uint256" }],
          type: "function",
        },
      ] as const,
      functionName: "balanceOf",
      args: [wallet.address as `0x${string}`],
    }) as bigint;

    if (usdcBalance === BigInt(0)) {
      return NextResponse.json({
        success: false,
        error: "No USDC found in this wallet",
        balance: "0",
      });
    }

    const usdcBalanceFormatted = formatUnits(usdcBalance, 6);
    console.log(`[Recover USDC] Found ${usdcBalanceFormatted} USDC in wallet ${wallet.address}`);

    // Get receiver wallet
    const receiverWallet = getReceiverWalletAddress();

    // Transfer USDC to receiver wallet
    console.log(`[Recover USDC] Transferring ${usdcBalanceFormatted} USDC to receiver wallet: ${receiverWallet}`);
    
    const usdcTransferHash = await walletClient.writeContract({
      address: USDC_BASE_ADDRESS as `0x${string}`,
      abi: [
        {
          constant: false,
          inputs: [
            { name: "_to", type: "address" },
            { name: "_value", type: "uint256" },
          ],
          name: "transfer",
          outputs: [{ name: "", type: "bool" }],
          type: "function",
        },
      ] as const,
      functionName: "transfer",
      args: [receiverWallet as `0x${string}`, usdcBalance],
    });

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: usdcTransferHash });

    if (receipt.status !== "success") {
      return NextResponse.json(
        { success: false, error: "USDC transfer transaction failed" },
        { status: 500 }
      );
    }

    console.log(`[Recover USDC] ✅ USDC transferred successfully: ${usdcTransferHash}`);

    // Update transaction status if needed
    if (transaction.status === "swapping" || transaction.status === "token_received") {
      await supabaseAdmin
        .from("offramp_transactions")
        .update({
          status: "usdc_received",
          usdc_amount: usdcBalanceFormatted,
          usdc_amount_raw: usdcBalance.toString(),
          updated_at: new Date().toISOString(),
        })
        .eq("transaction_id", transaction.transaction_id);
    }

    return NextResponse.json({
      success: true,
      message: "USDC recovered successfully",
      walletAddress: wallet.address,
      usdcAmount: usdcBalanceFormatted,
      usdcAmountRaw: usdcBalance.toString(),
      transferTxHash: usdcTransferHash,
      receiverWallet,
    });
  } catch (error: any) {
    console.error("[Recover USDC] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

