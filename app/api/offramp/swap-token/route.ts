import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, formatUnits, parseEther, formatEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { supabaseAdmin } from "@/lib/supabase";
import { generateUserOfframpWallet, getAdminWalletAddress, getMasterWallet, getReceiverWalletAddress } from "@/lib/offramp-wallet";
import { getSwapTransaction, USDC_BASE_ADDRESS, ZEROX_EXCHANGE_PROXY } from "@/lib/0x-swap";
import { BASE_RPC_URL } from "@/lib/constants";

/**
 * Swap token to USDC and send to admin wallet
 * POST /api/offramp/swap-token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId } = body;

    if (!transactionId) {
      return NextResponse.json(
        {
          success: false,
          message: "Transaction ID is required",
        },
        { status: 400 }
      );
    }

    // Get transaction from database
    const { data: transaction, error: txError } = await supabaseAdmin
      .from("offramp_transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single();

    if (txError || !transaction) {
      return NextResponse.json(
        {
          success: false,
          message: "Transaction not found",
        },
        { status: 404 }
      );
    }

    // Verify token is received
    if (!transaction.token_address || !transaction.token_amount_raw) {
      return NextResponse.json(
        {
          success: false,
          message: "Token not received yet or already processed",
        },
        { status: 400 }
      );
    }

    // Check if already swapping or swapped (but allow retry if stuck in swapping without tx hash)
    if (transaction.status === "swapping" && transaction.swap_tx_hash) {
      return NextResponse.json({
        success: true,
        message: "Swap already in progress",
        status: transaction.status,
        swapTxHash: transaction.swap_tx_hash,
      });
    }

    if (transaction.status === "usdc_received" || transaction.status === "completed") {
      return NextResponse.json({
        success: true,
        message: "Swap already completed",
        status: transaction.status,
        swapTxHash: transaction.swap_tx_hash,
      });
    }

    // If stuck in "swapping" status without a tx hash, reset to token_received for retry
    if (transaction.status === "swapping" && !transaction.swap_tx_hash) {
      console.log(`[Swap Token] Transaction stuck in swapping status, resetting to token_received for retry`);
      await supabaseAdmin
        .from("offramp_transactions")
        .update({
          status: "token_received",
          updated_at: new Date().toISOString(),
        })
        .eq("transaction_id", transactionId);
    }

    // Get the private key for this user's wallet
    // Use user_id if available, otherwise use user_email, or fallback to account number
    const userIdentifier = transaction.user_id || transaction.user_email || `guest_${transaction.user_account_number}`;
    const wallet = generateUserOfframpWallet(userIdentifier);
    const adminWallet = getAdminWalletAddress();
    
    // Verify wallet address matches the transaction's wallet address
    if (wallet.address.toLowerCase() !== transaction.unique_wallet_address.toLowerCase()) {
      console.error(`[Swap Token] Wallet address mismatch! Generated: ${wallet.address}, Transaction: ${transaction.unique_wallet_address}`);
      // This shouldn't happen, but if it does, log it and continue with the generated wallet
      // The transaction might have been created with the old system
    }

    // Create wallet and public clients
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

    // Update status to swapping
    await supabaseAdmin
      .from("offramp_transactions")
      .update({
        status: "swapping",
        updated_at: new Date().toISOString(),
      })
      .eq("transaction_id", transactionId);

    // Get swap transaction data from 0x
    const fromTokenAddress = transaction.token_address; // null for ETH
    const amount = transaction.token_amount_raw;
    const amountBigInt = BigInt(amount);

    console.log(`[Swap Token] Getting swap transaction for ${transaction.token_symbol} → USDC`);
    console.log(`[Swap Token] Amount: ${amount}, From: ${wallet.address}`);

    // For ERC20 tokens (not ETH), check if unique wallet has ETH for gas
    if (fromTokenAddress) {
      // Check ETH balance of unique wallet
      const ethBalance = await publicClient.getBalance({
        address: wallet.address as `0x${string}`,
      });

      // If less than 0.0002 ETH, forward some from master wallet (minimal for approval + swap)
      const minETHRequired = parseEther("0.0002");
      if (ethBalance < minETHRequired) {
        console.log(`[Swap Token] Unique wallet has insufficient ETH (${formatEther(ethBalance)}). Forwarding from master wallet...`);
        
        const masterWallet = getMasterWallet();
        const masterAccount = privateKeyToAccount(masterWallet.privateKey as `0x${string}`);
        const masterWalletClient = createWalletClient({
          account: masterAccount,
          chain: base,
          transport: http(BASE_RPC_URL),
        });

        // Check master wallet balance and send what's available (leave reserve for gas)
        const masterBalance = await publicClient.getBalance({
          address: masterWallet.address as `0x${string}`,
        });

        // Calculate how much we can send (leave 0.00002 ETH in master for gas - minimal reserve)
        const masterReserve = parseEther("0.00002");
        const availableToSend = masterBalance > masterReserve ? masterBalance - masterReserve : BigInt(0);
        
        if (availableToSend <= 0) {
          throw new Error(`Master wallet has insufficient ETH. Balance: ${formatEther(masterBalance)} ETH. Need at least 0.00002 ETH reserve. Please fund the master wallet: ${masterWallet.address}`);
        }

        // Send available ETH (but cap at 0.0002 ETH - minimal amount for approval + swap)
        const maxToSend = parseEther("0.0002");
        const ethAmount = availableToSend > maxToSend ? maxToSend : availableToSend;
        
        console.log(`[Forward ETH] Master wallet balance: ${formatEther(masterBalance)} ETH`);
        console.log(`[Forward ETH] Sending ${formatEther(ethAmount)} ETH from master wallet (${masterWallet.address}) to unique wallet (${wallet.address})`);

        const ethTxHash = await masterWalletClient.sendTransaction({
          to: wallet.address as `0x${string}`,
          value: ethAmount,
        });

        console.log(`[Forward ETH] Transaction sent: ${ethTxHash}`);
        
        // Wait for confirmation
        await publicClient.waitForTransactionReceipt({ hash: ethTxHash });
        console.log(`[Forward ETH] ✅ ETH forwarded successfully`);
      }

      // For ERC20 tokens (not ETH), we need to approve the 0x Exchange Proxy first
      // Check current allowance
      const allowance = (await publicClient.readContract({
        address: fromTokenAddress as `0x${string}`,
        abi: [
          {
            constant: true,
            inputs: [
              { name: "_owner", type: "address" },
              { name: "_spender", type: "address" },
            ],
            name: "allowance",
            outputs: [{ name: "", type: "uint256" }],
            type: "function",
          },
          {
            constant: false,
            inputs: [
              { name: "_spender", type: "address" },
              { name: "_value", type: "uint256" },
            ],
            name: "approve",
            outputs: [{ name: "", type: "bool" }],
            type: "function",
          },
        ] as const,
        functionName: "allowance",
        args: [wallet.address as `0x${string}`, ZEROX_EXCHANGE_PROXY as `0x${string}`],
      })) as bigint;

      if (allowance < amountBigInt) {
        console.log(`[Swap Token] Approving 0x Exchange Proxy to spend ${transaction.token_symbol}...`);
        console.log(`[Swap Token] Current allowance: ${allowance.toString()}, Required: ${amountBigInt.toString()}`);
        
        // Use max uint256 for approval to avoid needing to approve again
        const maxApproval = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
        
        // Approve the router to spend tokens
        const approveHash = await walletClient.writeContract({
          address: fromTokenAddress as `0x${string}`,
          abi: [
            {
              constant: false,
              inputs: [
                { name: "_spender", type: "address" },
                { name: "_value", type: "uint256" },
              ],
              name: "approve",
              outputs: [{ name: "", type: "bool" }],
              type: "function",
            },
          ] as const,
          functionName: "approve",
          args: [ZEROX_EXCHANGE_PROXY as `0x${string}`, maxApproval],
        });

        console.log(`[Swap Token] Approval transaction sent: ${approveHash}`);
        
        // Wait for approval confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
        
        if (receipt.status !== "success") {
          throw new Error("Approval transaction failed");
        }
        
        console.log(`[Swap Token] ✅ Approval confirmed`);
        
        // Verify allowance was set correctly (wait a bit for state to update)
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for state sync
        
        const newAllowance = (await publicClient.readContract({
          address: fromTokenAddress as `0x${string}`,
          abi: [
            {
              constant: true,
              inputs: [
                { name: "_owner", type: "address" },
                { name: "_spender", type: "address" },
              ],
              name: "allowance",
              outputs: [{ name: "", type: "uint256" }],
              type: "function",
            },
          ] as const,
          functionName: "allowance",
          args: [wallet.address as `0x${string}`, ZEROX_EXCHANGE_PROXY as `0x${string}`],
        })) as bigint;
        
        console.log(`[Swap Token] Verified allowance: ${newAllowance.toString()}`);
        
        if (newAllowance < amountBigInt) {
          throw new Error(`Approval failed: Allowance is ${newAllowance.toString()}, but need ${amountBigInt.toString()}`);
        }
      }
    }

    // Double-check allowance before calling 0x (in case approval just completed)
    if (fromTokenAddress) {
      const finalAllowanceCheck = (await publicClient.readContract({
        address: fromTokenAddress as `0x${string}`,
        abi: [
          {
            constant: true,
            inputs: [
              { name: "_owner", type: "address" },
              { name: "_spender", type: "address" },
            ],
            name: "allowance",
            outputs: [{ name: "", type: "uint256" }],
            type: "function",
          },
        ] as const,
        functionName: "allowance",
        args: [wallet.address as `0x${string}`, ZEROX_EXCHANGE_PROXY as `0x${string}`],
      })) as bigint;
      
      console.log(`[Swap Token] Final allowance check before 0x call: ${finalAllowanceCheck.toString()}`);
      
      if (finalAllowanceCheck < amountBigInt) {
        throw new Error(`Allowance insufficient before swap: ${finalAllowanceCheck.toString()} < ${amountBigInt.toString()}. Approval may have failed.`);
      }
    }

    console.log(`[Swap Token] Calling 0x API to get swap transaction...`);
    const swapResult = await getSwapTransaction(
      fromTokenAddress,
      USDC_BASE_ADDRESS,
      amount,
      wallet.address, // Send USDC to unique wallet first (will transfer to receiver wallet after)
      1 // 1% slippage
    );

    if (!swapResult.success || !swapResult.tx) {
      console.error("[Swap Token] Failed to get swap transaction:", swapResult.error);
      
      // If error is about allowance, check current allowance and log it
      if (swapResult.error?.includes("allowance") || swapResult.error?.includes("Allowance")) {
        if (fromTokenAddress) {
          const currentAllowance = (await publicClient.readContract({
            address: fromTokenAddress as `0x${string}`,
            abi: [
              {
                constant: true,
                inputs: [
                  { name: "_owner", type: "address" },
                  { name: "_spender", type: "address" },
                ],
                name: "allowance",
                outputs: [{ name: "", type: "uint256" }],
                type: "function",
              },
            ] as const,
            functionName: "allowance",
            args: [wallet.address as `0x${string}`, ZEROX_EXCHANGE_PROXY as `0x${string}`],
          })) as bigint;
          
          console.error(`[Swap Token] Current allowance when 0x failed: ${currentAllowance.toString()}`);
          console.error(`[Swap Token] Required amount: ${amountBigInt.toString()}`);
        }
      }
      
      // Update status back to token_received
      await supabaseAdmin
        .from("offramp_transactions")
        .update({
          status: "token_received",
          error_message: swapResult.error || "Failed to get swap transaction",
          updated_at: new Date().toISOString(),
        })
        .eq("transaction_id", transactionId);

      return NextResponse.json(
        {
          success: false,
          message: swapResult.error || "Failed to get swap transaction",
        },
        { status: 500 }
      );
    }

    // Execute the swap transaction
    console.log(`[Swap Token] Executing swap transaction...`);
    
    try {
      const txHash = await walletClient.sendTransaction({
        to: swapResult.tx.to as `0x${string}`,
        data: swapResult.tx.data as `0x${string}`,
        value: swapResult.tx.value ? BigInt(swapResult.tx.value) : BigInt(0),
        gas: swapResult.tx.gas ? BigInt(swapResult.tx.gas) : undefined,
      });

      console.log(`[Swap Token] ✅ Swap transaction sent: ${txHash}`);

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      if (receipt.status === "success") {
        // Get USDC amount from the swap result
        const usdcAmount = swapResult.tx.buyAmount || swapResult.tx.dstAmount || "0";
        const usdcAmountFormatted = formatUnits(BigInt(usdcAmount), 6); // USDC has 6 decimals
        
        // Update transaction with swap info
        await supabaseAdmin
          .from("offramp_transactions")
          .update({
            swap_tx_hash: txHash,
            usdc_amount: usdcAmountFormatted,
            usdc_amount_raw: usdcAmount,
            swap_attempts: (transaction.swap_attempts || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("transaction_id", transactionId);

        // Record swap attempt
        await supabaseAdmin.from("offramp_swap_attempts").insert({
          transaction_id: transactionId,
          attempt_number: (transaction.swap_attempts || 0) + 1,
          swap_tx_hash: txHash,
          status: "success",
        });

        console.log(`[Swap Token] ✅ Swap successful. USDC received in unique wallet: ${wallet.address}`);
        
        // Transfer USDC from unique wallet to receiver wallet
        const receiverWallet = getReceiverWalletAddress();
        try {
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
            functionName: "balanceOf",
            args: [wallet.address as `0x${string}`],
          }) as bigint;

          if (usdcBalance > BigInt(0)) {
            console.log(`[Swap Token] Transferring ${formatUnits(usdcBalance, 6)} USDC to receiver wallet: ${receiverWallet}`);
            
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

            await publicClient.waitForTransactionReceipt({ hash: usdcTransferHash });
            console.log(`[Swap Token] ✅ USDC transferred to receiver wallet: ${usdcTransferHash}`);
            
            // Update status to usdc_received after successful USDC transfer
            await supabaseAdmin
              .from("offramp_transactions")
              .update({
                status: "usdc_received",
                usdc_received_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("transaction_id", transactionId);
            
            console.log(`[Swap Token] ✅ Status updated to usdc_received`);
          } else {
            console.warn(`[Swap Token] ⚠️ No USDC balance found in unique wallet after swap`);
            // Still update status if we have usdc_amount from swap result
            if (usdcAmount && usdcAmount !== "0") {
              await supabaseAdmin
                .from("offramp_transactions")
                .update({
                  status: "usdc_received",
                  usdc_received_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq("transaction_id", transactionId);
            }
          }
        } catch (error) {
          console.error("[Swap Token] Error transferring USDC to receiver wallet:", error);
          // Don't fail the whole transaction, but log the error
        }
        
        // Send any remaining ETH from unique wallet to master wallet (not admin wallet)
        try {
          const remainingETH = await publicClient.getBalance({
            address: wallet.address as `0x${string}`,
          });

          const minETHToSend = parseEther("0.0001");
          if (remainingETH > minETHToSend) {
            const masterWallet = getMasterWallet();
            console.log(`[Swap Token] Sending remaining ETH (${formatEther(remainingETH)}) to master wallet: ${masterWallet.address}`);
            
            // Leave a tiny amount for safety, send the rest
            const ethToSend = remainingETH - parseEther("0.00001");
            
            const ethTransferHash = await walletClient.sendTransaction({
              to: masterWallet.address as `0x${string}`,
              value: ethToSend,
            });

            await publicClient.waitForTransactionReceipt({ hash: ethTransferHash });
            console.log(`[Swap Token] ✅ Remaining ETH sent to master wallet`);
          }
        } catch (error) {
          console.error("[Swap Token] Error sending remaining ETH:", error);
          // Don't fail the whole transaction if this fails
        }
        
        return NextResponse.json({
          success: true,
          swapTxHash: txHash,
          usdcAmount: usdcAmountFormatted,
          message: "Swap transaction successful",
        });
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error: any) {
      console.error("[Swap Token] Error executing swap:", error);
      
      // Update transaction with error
      await supabaseAdmin
        .from("offramp_transactions")
        .update({
          status: "token_received",
          error_message: error.message || "Swap transaction failed",
          swap_attempts: (transaction.swap_attempts || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("transaction_id", transactionId);

      // Record failed swap attempt
      await supabaseAdmin.from("offramp_swap_attempts").insert({
        transaction_id: transactionId,
        attempt_number: (transaction.swap_attempts || 0) + 1,
        status: "failed",
        error_message: error.message || "Swap transaction failed",
      });

      return NextResponse.json(
        {
          success: false,
          message: error.message || "Failed to execute swap transaction",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Swap Token] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "An error occurred",
      },
      { status: 500 }
    );
  }
}

