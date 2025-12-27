import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, parseUnits } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminWallet } from "@/lib/supabase";
import { generateUserOfframpWallet } from "@/lib/offramp-wallet";
import { BASE_RPC_URL } from "@/lib/constants";

// ERC20 ABI for token transfer
const ERC20_ABI = [
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
] as const;

/**
 * Refund tokens to user (Admin only)
 * POST /api/admin/offramp/[id]/refund
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { adminWallet, refundToAddress } = body;
    const { id: transactionId } = await params;

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

    // Get transaction
    const { data: transaction, error: txError } = await supabaseAdmin
      .from("offramp_transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single();

    if (txError || !transaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Check if transaction can be refunded
    if (transaction.status === "completed") {
      return NextResponse.json(
        { success: false, error: "Transaction already completed, cannot refund" },
        { status: 400 }
      );
    }

    if (!transaction.token_address || !transaction.token_amount_raw) {
      return NextResponse.json(
        { success: false, error: "No token to refund" },
        { status: 400 }
      );
    }

    // Get refund address (from user's wallets or provided)
    let refundAddress = refundToAddress;
    
    if (!refundAddress && transaction.user_id) {
      // Try to get user's wallet from user_wallets table
      const { data: userWallets } = await supabaseAdmin
        .from("user_wallets")
        .select("wallet_address")
        .eq("user_id", transaction.user_id)
        .limit(1)
        .single();

      if (userWallets) {
        refundAddress = userWallets.wallet_address;
      }
    }

    if (!refundAddress) {
      return NextResponse.json(
        { success: false, error: "Refund address required. Please provide refundToAddress." },
        { status: 400 }
      );
    }

    // Get the user's wallet private key
    // Use user_id if available, otherwise use user_email, or fallback to account number
    const userIdentifier = transaction.user_id || transaction.user_email || `guest_${transaction.user_account_number}`;
    const wallet = generateUserOfframpWallet(userIdentifier);
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

    // Refund tokens
    let refundTxHash: string;

    if (transaction.token_address === null) {
      // Native ETH refund
      refundTxHash = await walletClient.sendTransaction({
        to: refundAddress as `0x${string}`,
        value: BigInt(transaction.token_amount_raw),
      });
    } else {
      // ERC20 token refund
      refundTxHash = await walletClient.writeContract({
        address: transaction.token_address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [refundAddress as `0x${string}`, BigInt(transaction.token_amount_raw)],
      });
    }

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: refundTxHash as `0x${string}`,
    });

    if (receipt.status === "success") {
      // Update transaction status
      await supabaseAdmin
        .from("offramp_transactions")
        .update({
          status: "refunded",
          refund_tx_hash: refundTxHash,
          updated_at: new Date().toISOString(),
        })
        .eq("transaction_id", transactionId);

      return NextResponse.json({
        success: true,
        refundTxHash,
        message: "Tokens refunded successfully",
      });
    } else {
      throw new Error("Refund transaction failed");
    }
  } catch (error: any) {
    console.error("[Admin OffRamp Refund] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

