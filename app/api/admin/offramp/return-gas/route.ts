import { NextRequest, NextResponse } from "next/server";
import { isAdminWallet } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase";
import { createWalletClient, createPublicClient, http, formatEther, parseEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { BASE_RPC_URL } from "@/lib/constants";
import { generateUserOfframpWallet, getMasterWallet } from "@/lib/offramp-wallet";

/**
 * Return remaining gas fees from a wallet to master wallet (Admin only)
 * POST /api/admin/offramp/return-gas
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminWallet, walletAddress, userIdentifier } = body; // Allow manual user identifier

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

    // First, check the balance directly to verify there's ETH to return
    const publicClientForBalance = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    const addressToCheck = walletAddress.toLowerCase() as `0x${string}`;
    const directBalance = await publicClientForBalance.getBalance({
      address: addressToCheck,
    });

    console.log(`[Return Gas] Direct balance check: ${formatEther(directBalance)} ETH for ${addressToCheck}`);

    if (directBalance === BigInt(0)) {
      return NextResponse.json({
        success: false,
        error: "No ETH to return",
        balance: formatEther(directBalance),
        checkedAddress: addressToCheck,
        rpcUrl: BASE_RPC_URL,
      });
    }

    // If userIdentifier is provided manually, use it directly (skip transaction lookup)
    let wallet;
    let finalUserIdentifier = userIdentifier;
    let transaction;
    
    if (userIdentifier) {
      // User provided identifier directly - generate wallet and proceed
      try {
        wallet = generateUserOfframpWallet(userIdentifier);
        if (wallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
          return NextResponse.json(
            {
              success: false,
              error: "Provided user identifier does not generate the specified wallet address",
              providedIdentifier: userIdentifier,
              generatedAddress: wallet.address,
              expectedAddress: walletAddress.toLowerCase(),
              balance: formatEther(directBalance),
            },
            { status: 400 }
          );
        }
        console.log(`[Return Gas] Using manually provided user identifier: ${userIdentifier}`);
        // Try to find a transaction for reference, but don't require it
        const { data: transactions } = await supabaseAdmin
          .from("offramp_transactions")
          .select("*")
          .eq("unique_wallet_address", walletAddress.toLowerCase())
          .order("created_at", { ascending: false })
          .limit(1);
        transaction = transactions?.[0] || null;
      } catch (error: any) {
        return NextResponse.json(
          {
            success: false,
            error: "Failed to generate wallet from provided identifier",
            details: error.message,
            balance: formatEther(directBalance),
          },
          { status: 400 }
        );
      }
    } else {
      // No userIdentifier provided - need to find transaction to derive it
      const { data: transactions, error } = await supabaseAdmin
        .from("offramp_transactions")
        .select("*")
        .eq("unique_wallet_address", walletAddress.toLowerCase())
        .order("created_at", { ascending: false });

      if (error || !transactions || transactions.length === 0) {
        // If no transaction found but balance exists, we can't sign, but report the balance
        return NextResponse.json(
          {
            success: false,
            error: "No transaction found for this wallet address. Cannot sign transaction without wallet private key.",
            walletAddress: walletAddress.toLowerCase(),
            balance: formatEther(directBalance),
            hint: "Provide userIdentifier parameter to manually specify the user identifier used to generate this wallet.",
          },
          { status: 404 }
        );
      }
      
      // Try all transactions to find one that generates the correct wallet
      let foundIdentifier: string | undefined;
      for (const tx of transactions) {
        // Try user_id first (most reliable)
        if (tx.user_id) {
          try {
            const testWallet = generateUserOfframpWallet(tx.user_id);
            if (testWallet.address.toLowerCase() === walletAddress.toLowerCase()) {
              wallet = testWallet;
              foundIdentifier = tx.user_id;
              transaction = tx;
              console.log(`[Return Gas] Found matching wallet using user_id: ${foundIdentifier}`);
              break;
            }
          } catch (error) {
            // Continue to next identifier
          }
        }
        
        // Try user_email
        if (tx.user_email && tx.user_email !== "test@example.com") {
          try {
            const testWallet = generateUserOfframpWallet(tx.user_email);
            if (testWallet.address.toLowerCase() === walletAddress.toLowerCase()) {
              wallet = testWallet;
              foundIdentifier = tx.user_email;
              transaction = tx;
              console.log(`[Return Gas] Found matching wallet using user_email: ${foundIdentifier}`);
              break;
            }
          } catch (error) {
            // Continue to next identifier
          }
        }
        
        // Try guest identifier
        if (tx.user_account_number) {
          try {
            const guestId = `guest_${tx.user_account_number}`;
            const testWallet = generateUserOfframpWallet(guestId);
            if (testWallet.address.toLowerCase() === walletAddress.toLowerCase()) {
              wallet = testWallet;
              foundIdentifier = guestId;
              transaction = tx;
              console.log(`[Return Gas] Found matching wallet using guest identifier: ${foundIdentifier}`);
              break;
            }
          } catch (error) {
            // Continue to next identifier
          }
        }
        
        // Try old transaction-based system
        try {
          const { generateOfframpWallet } = await import("@/lib/offramp-wallet");
          const oldWallet = generateOfframpWallet(tx.transaction_id);
          if (oldWallet.address.toLowerCase() === walletAddress.toLowerCase()) {
            wallet = oldWallet;
            foundIdentifier = tx.transaction_id;
            transaction = tx;
            console.log(`[Return Gas] Found matching wallet using transaction_id (old system): ${foundIdentifier}`);
            break;
          }
        } catch (error) {
          // Continue to next transaction
        }
      }
      
      // Set final user identifier if found
      if (foundIdentifier) {
        finalUserIdentifier = foundIdentifier;
      }
    }

    // Final check - wallet must be set and match the provided address
    if (!wallet || wallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json(
        {
          success: false,
          error: "Wallet address mismatch. Could not determine correct user identifier.",
          transactionId: transaction?.transaction_id || "unknown",
          userEmail: transaction?.user_email || "unknown",
          userId: transaction?.user_id || "unknown",
          generated: wallet?.address || "unknown",
          provided: walletAddress.toLowerCase(),
          balance: formatEther(directBalance),
          hint: "This wallet may have been generated with a different identifier or using the old transaction-based system. Please verify the wallet was generated by our system.",
        },
        { status: 400 }
      );
    }

    // Create clients
    const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    // CRITICAL FIX: Use the balance we already checked (directBalance)
    // This ensures we use the actual balance from the blockchain, checked directly from the provided address
    const ethBalance = directBalance;
    const balanceFormatted = formatEther(ethBalance);
    
    // Verify derived wallet matches provided address
    if (wallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
      console.warn(`[Return Gas] Wallet derivation mismatch! Derived: ${wallet.address}, Provided: ${walletAddress}`);
      // Still proceed, but we'll verify we can sign before sending
    }

    console.log(`[Return Gas] Using balance: ${balanceFormatted} ETH for address: ${addressToCheck}`);
    console.log(`[Return Gas] Derived wallet address: ${wallet.address.toLowerCase()}`);

    // Create clients for transaction signing
    const publicClient = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    // Get master wallet
    const masterWallet = getMasterWallet();

    // Calculate amount to send (leave 0.00001 ETH for safety)
    const minReserve = parseEther("0.00001");
    const ethToSend = ethBalance > minReserve ? ethBalance - minReserve : BigInt(0);

    if (ethToSend === BigInt(0)) {
      return NextResponse.json({
        success: false,
        error: "Balance too low to return (need at least 0.00001 ETH reserve)",
        balance: balanceFormatted,
        minReserve: formatEther(minReserve),
        checkedAddress: addressToCheck,
      });
    }

    // IMPORTANT: Verify we can sign for this address before attempting transfer
    if (wallet.address.toLowerCase() !== addressToCheck) {
      return NextResponse.json({
        success: false,
        error: "Cannot return gas: Wallet address mismatch. Cannot sign transactions for provided address.",
        providedAddress: walletAddress,
        derivedAddress: wallet.address,
        balance: balanceFormatted,
        hint: "The provided wallet address was not generated by this system's master mnemonic. Cannot sign transactions.",
      }, { status: 400 });
    }

    console.log(`[Return Gas] Sending ${formatEther(ethToSend)} ETH from ${addressToCheck} to ${masterWallet.address}`);

    // Send ETH
    const txHash = await walletClient.sendTransaction({
      to: masterWallet.address as `0x${string}`,
      value: ethToSend,
    });

    console.log(`[Return Gas] Transaction sent: ${txHash}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status === "success") {
      return NextResponse.json({
        success: true,
        message: "Gas fees returned successfully",
        transactionId: transaction?.transaction_id || "N/A",
        walletAddress: addressToCheck,
        txHash: txHash,
        amountReturned: formatEther(ethToSend),
        remaining: formatEther(minReserve),
        originalBalance: balanceFormatted,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Transaction failed",
          txHash: txHash,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[Return Gas] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

