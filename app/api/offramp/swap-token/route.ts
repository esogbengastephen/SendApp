import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, formatUnits, parseEther, formatEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { supabaseAdmin } from "@/lib/supabase";
import { generateUserOfframpWallet, getAdminWalletAddress, getMasterWallet, getReceiverWalletAddress } from "@/lib/offramp-wallet";
import { USDC_BASE_ADDRESS, ZEROX_EXCHANGE_PROXY } from "@/lib/0x-swap";
import { getSmartSwapTransaction } from "@/lib/smart-swap";
import { AERODROME_ROUTER } from "@/lib/aerodrome-swap";
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
    // If token_address is null (ETH was detected first), check all_tokens_detected for ERC20 tokens
    let tokenAddress = transaction.token_address;
    let tokenAmountRaw = transaction.token_amount_raw;
    let tokenSymbol = transaction.token_symbol;
    let tokenAmount = transaction.token_amount;

    if (!tokenAddress || !tokenAmountRaw) {
      // Check all_tokens_detected for ERC20 tokens (prefer non-ETH tokens)
      if (transaction.all_tokens_detected) {
        try {
          const allTokens = typeof transaction.all_tokens_detected === 'string' 
            ? JSON.parse(transaction.all_tokens_detected) 
            : transaction.all_tokens_detected;
          
          // Find first ERC20 token (non-ETH, non-null address)
          const erc20Token = Array.isArray(allTokens) 
            ? allTokens.find((t: any) => t.address && t.address !== null && t.symbol !== 'ETH')
            : null;
          
          if (erc20Token) {
            console.log(`[Swap Token] Using ERC20 token from all_tokens_detected: ${erc20Token.symbol}`);
            tokenAddress = erc20Token.address;
            tokenAmountRaw = erc20Token.amountRaw;
            tokenSymbol = erc20Token.symbol;
            tokenAmount = erc20Token.amount;
            
            // Update transaction to use this token as primary
            await supabaseAdmin
              .from("offramp_transactions")
              .update({
                token_address: tokenAddress,
                token_symbol: tokenSymbol,
                token_amount: tokenAmount,
                token_amount_raw: tokenAmountRaw,
                updated_at: new Date().toISOString(),
              })
              .eq("transaction_id", transactionId);
          }
        } catch (error) {
          console.error("[Swap Token] Error parsing all_tokens_detected:", error);
        }
      }
      
      // If still no token address, return error
      if (!tokenAddress || !tokenAmountRaw) {
        return NextResponse.json(
          {
            success: false,
            message: "Token not received yet or already processed",
          },
          { status: 400 }
        );
      }
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

    // If status is usdc_received or completed, verify the transaction actually exists on-chain
    if (transaction.status === "usdc_received" || transaction.status === "completed") {
      // Verify the swap transaction actually exists on-chain
      if (transaction.swap_tx_hash) {
        try {
          const receipt = await publicClient.getTransactionReceipt({
            hash: transaction.swap_tx_hash as `0x${string}`,
          });
          
          if (receipt && receipt.status === "success") {
            // Transaction exists and succeeded, return early
            return NextResponse.json({
              success: true,
              message: "Swap already completed",
              status: transaction.status,
              swapTxHash: transaction.swap_tx_hash,
            });
          } else if (receipt && receipt.status === "reverted") {
            // Transaction reverted, allow retry
            console.log(`[Swap Token] Previous swap transaction reverted, allowing retry`);
            await supabaseAdmin
              .from("offramp_transactions")
              .update({
                status: "token_received",
                error_message: "Previous swap transaction reverted",
                swap_tx_hash: null,
                updated_at: new Date().toISOString(),
              })
              .eq("transaction_id", transactionId);
          }
        } catch (error: any) {
          // Transaction doesn't exist on-chain, allow retry
          console.log(`[Swap Token] Previous swap transaction not found on-chain, allowing retry: ${error.message}`);
          await supabaseAdmin
            .from("offramp_transactions")
            .update({
              status: "token_received",
              error_message: "Previous swap transaction not found on-chain",
              swap_tx_hash: null,
              usdc_amount: null,
              usdc_amount_raw: null,
              updated_at: new Date().toISOString(),
            })
            .eq("transaction_id", transactionId);
        }
      } else {
        // No swap_tx_hash but status is usdc_received - this is invalid, reset
        console.log(`[Swap Token] Status is usdc_received but no swap_tx_hash, resetting`);
        await supabaseAdmin
          .from("offramp_transactions")
          .update({
            status: "token_received",
            error_message: "Invalid state: usdc_received without swap_tx_hash",
            updated_at: new Date().toISOString(),
          })
          .eq("transaction_id", transactionId);
      }
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
    // CRITICAL: MUST use stored wallet_identifier for consistent wallet derivation
    if (!transaction.wallet_identifier) {
      console.error(`[Swap Token] ❌ CRITICAL ERROR: wallet_identifier not found in transaction!`);
      console.error(`[Swap Token] Transaction ID: ${transactionId}`);
      console.error(`[Swap Token] This transaction was created before the wallet_identifier field was added.`);
      throw new Error(`Transaction missing wallet_identifier. Please create a new transaction.`);
    }
    
    const userIdentifier = transaction.wallet_identifier;
    console.log(`[Swap Token] ✅ Using stored wallet_identifier: ${userIdentifier}`);
    
    const wallet = generateUserOfframpWallet(userIdentifier);
    const adminWallet = getAdminWalletAddress();
    
    // Verify wallet address matches the transaction's wallet address
    if (wallet.address.toLowerCase() !== transaction.unique_wallet_address.toLowerCase()) {
      console.error(`[Swap Token] ❌ CRITICAL ERROR: Wallet address mismatch!`);
      console.error(`[Swap Token] Generated wallet: ${wallet.address}`);
      console.error(`[Swap Token] Transaction wallet: ${transaction.unique_wallet_address}`);
      console.error(`[Swap Token] Identifier used: ${userIdentifier}`);
      
      // This is a critical error - the wrong wallet is trying to swap tokens it doesn't own!
      throw new Error(`Wallet mismatch: Generated ${wallet.address} but transaction expects ${transaction.unique_wallet_address}. This means the wallet derivation is incorrect and the swap will fail.`);
    }
    
    console.log(`[Swap Token] ✅ Wallet verified: ${wallet.address}`);

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
    const fromTokenAddress = tokenAddress; // Use the resolved token address
    const amount = tokenAmountRaw;
    const amountBigInt = BigInt(amount);

    console.log(`[Swap Token] Getting swap transaction for ${tokenSymbol} → USDC`);
    console.log(`[Swap Token] Amount: ${amount}, From: ${wallet.address}`);

    // ========================================================================
    // STEP 1: Get swap transaction using smart routing (3-layer cascade)
    // This will try Gasless first, then traditional 0x, then Aerodrome
    // ========================================================================
    console.log(`[Swap Token] Calling 3-layer smart swap (Gasless → 0x → Aerodrome)...`);
    const swapResult = await getSmartSwapTransaction(
      fromTokenAddress,
      USDC_BASE_ADDRESS,
      amount,
      wallet.address,
      1 // 1% slippage
    );

    if (!swapResult.success || !swapResult.tx) {
      console.error(`[Swap Token] Failed to get swap transaction:`, swapResult.error);
      
      // Update status back to token_received
      await supabaseAdmin
        .from("offramp_transactions")
        .update({
          status: "token_received",
          error_message: swapResult.error || "Failed to get swap transaction from all providers",
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

    console.log(`[Swap Token] ✅ Swap transaction ready using: ${swapResult.provider} (Layer ${swapResult.layerUsed})`);
    console.log(`[Swap Token] Gas Required: ${swapResult.gasRequired ? "YES (needs ETH)" : "NO (gasless)"}`);

    // ========================================================================
    // STEP 2: Handle ETH funding and approvals
    // - ALL swaps need ETH to submit the transaction
    // - Gasless: NO on-chain approval (Permit2 signature), but swap tx needs ETH
    // - Traditional: Both approval AND swap need ETH
    // ========================================================================
    if (fromTokenAddress) {
      const isGasless = swapResult.provider === "0x-gasless";
      console.log(`[Swap Token] 💰 Funding ETH for swap transaction...`);
      console.log(`[Swap Token] Provider: ${swapResult.provider} (Layer ${swapResult.layerUsed})`);
      console.log(`[Swap Token] Mode: ${isGasless ? "GASLESS (free approval, ETH for swap)" : "TRADITIONAL (ETH for approval + swap)"}`);
      
      // For ERC20 tokens (not ETH), check if unique wallet has ETH for gas
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

      // ====================================================================
      // APPROVAL LOGIC
      // - Gasless: NO on-chain approval needed (uses Permit2 signature)
      // - Traditional: Needs on-chain approval
      // ====================================================================
      if (isGasless) {
        console.log(`[Swap Token] ✅ Gasless mode - NO on-chain approval needed (will use Permit2 signature)`);
      } else {
        console.log(`[Swap Token] Traditional mode - checking if on-chain approval is needed...`);
        
        const spenderAddress = ZEROX_EXCHANGE_PROXY;
        console.log(`[Swap Token] Checking allowance for spender: ${spenderAddress}`);
        
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
        console.log(`[Swap Token] Approving ${spenderAddress} to spend ${transaction.token_symbol}...`);
        console.log(`[Swap Token] Provider: ${swapResult.provider}`);
        console.log(`[Swap Token] Current allowance: ${allowance.toString()}, Required: ${amountBigInt.toString()}`);
        
        // Use max uint256 for approval to avoid needing to approve again
        const maxApproval = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
        
        // Get current nonce to avoid "nonce too low" errors (especially important for retries)
        const currentNonce = await publicClient.getTransactionCount({
          address: wallet.address as `0x${string}`,
        });
        console.log(`[Swap Token] Current nonce for approval: ${currentNonce}`);
        
        // Approve the appropriate spender (Permit2 for gasless, router for traditional)
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
          args: [spenderAddress as `0x${string}`, maxApproval],
          nonce: currentNonce, // Explicitly set nonce to ensure it's current
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
          args: [wallet.address as `0x${string}`, spenderAddress as `0x${string}`],
        })) as bigint;
        
        console.log(`[Swap Token] Verified allowance: ${newAllowance.toString()}`);
        
        if (newAllowance < amountBigInt) {
          throw new Error(`Approval failed: Allowance is ${newAllowance.toString()}, but need ${amountBigInt.toString()}`);
        }
      } else {
        console.log(`[Swap Token] ✅ Sufficient allowance already exists`);
      }
      } // End of !isGasless block
    } else {
      console.log(`[Swap Token] ⚠️  No token address (native ETH) or ETH not needed - skipping ETH funding and approval`);
    }

    // ========================================================================
    // STEP 3: Execute the swap transaction
    // ========================================================================
    console.log(`[Swap Token] Executing swap transaction using ${swapResult.provider} (Layer ${swapResult.layerUsed})...`);
    
    let txHash: string;
    let usdcAmount: string;
    
    try {
      if (swapResult.provider === "0x-gasless") {
        // ====================================================================
        // GASLESS SWAP EXECUTION (Permit2)
        // ====================================================================
        console.log(`[Swap Token] 🎯 Executing GASLESS swap with Permit2...`);
        
        if (!swapResult.tx.permit2 || !swapResult.tx.permit2.eip712) {
          throw new Error("Gasless swap selected but no Permit2 data available");
        }

        // Step 1: Sign the Permit2 message (off-chain, no gas)
        console.log(`[Swap Token] 📝 Signing Permit2 message (no gas)...`);
        const signature = await walletClient.signTypedData({
          account: walletClient.account,
          domain: swapResult.tx.permit2.eip712.domain,
          types: swapResult.tx.permit2.eip712.types,
          primaryType: swapResult.tx.permit2.eip712.primaryType,
          message: swapResult.tx.permit2.eip712.message,
        });

        console.log(`[Swap Token] ✅ Permit2 message signed: ${signature.slice(0, 20)}...`);

        // Step 2: Append signature to transaction data
        const { concat, numberToHex, size } = await import("viem");
        const signatureLengthInHex = numberToHex(size(signature), {
          signed: false,
          size: 32,
        });

        const finalTransactionData = concat([
          swapResult.tx.data as `0x${string}`,
          signatureLengthInHex as `0x${string}`,
          signature as `0x${string}`
        ]);

        console.log(`[Swap Token] 📤 Sending gasless transaction (gas deducted from output)...`);

        // Step 3: Get current nonce before executing swap
        const swapNonce = await publicClient.getTransactionCount({
          address: wallet.address as `0x${string}`,
        });
        console.log(`[Swap Token] Current nonce for swap: ${swapNonce}`);

        // Step 4: Execute the swap transaction
        const gasLimit = swapResult.tx.gas ? BigInt(Math.floor(Number(swapResult.tx.gas) * 1.5)) : BigInt(600000);
        
        txHash = await walletClient.sendTransaction({
          to: swapResult.tx.to as `0x${string}`,
          data: finalTransactionData,
          value: swapResult.tx.value ? BigInt(swapResult.tx.value) : BigInt(0),
          gas: gasLimit,
          nonce: swapNonce, // Explicitly set nonce to avoid "nonce too low" errors
        });

        usdcAmount = swapResult.tx.buyAmount || swapResult.tx.dstAmount || "0";
        console.log(`[Swap Token] ✅ Gasless swap transaction sent: ${txHash}`);
        console.log(`[Swap Token] 💰 Cost: $0 ETH (fees deducted from ${formatUnits(BigInt(usdcAmount), 6)} USDC output)`);
        
      } else if (swapResult.provider === "aerodrome") {
        // ====================================================================
        // AERODROME SWAP EXECUTION
        // ====================================================================
        console.log(`[Swap Token] 🎯 Executing Aerodrome swap...`);
        const { executeAerodromeSwap } = await import("@/lib/aerodrome-swap");
        const aeroResult = await executeAerodromeSwap(
          fromTokenAddress!,
          USDC_BASE_ADDRESS,
          amount,
          wallet.address,
          account,
          1
        );
        
        if (!aeroResult.success || !aeroResult.txHash) {
          throw new Error(`Aerodrome swap execution failed: ${aeroResult.error}`);
        }
        
        txHash = aeroResult.txHash;
        usdcAmount = aeroResult.outputAmount || swapResult.tx.buyAmount || swapResult.tx.dstAmount || "0";
        console.log(`[Swap Token] ✅ Aerodrome swap transaction sent: ${txHash}`);
        console.log(`[Swap Token] 💰 Cost: ~$0.60 ETH (traditional gas)`);
        
      } else {
        // ====================================================================
        // TRADITIONAL 0x SWAP EXECUTION
        // ====================================================================
        console.log(`[Swap Token] 🎯 Executing traditional 0x swap...`);
        
        // Get current nonce before executing swap
        const swapNonce = await publicClient.getTransactionCount({
          address: wallet.address as `0x${string}`,
        });
        console.log(`[Swap Token] Current nonce for swap: ${swapNonce}`);
        
        txHash = await walletClient.sendTransaction({
          to: swapResult.tx.to as `0x${string}`,
          data: swapResult.tx.data as `0x${string}`,
          value: swapResult.tx.value ? BigInt(swapResult.tx.value) : BigInt(0),
          gas: swapResult.tx.gas ? BigInt(swapResult.tx.gas) : undefined,
          nonce: swapNonce, // Explicitly set nonce to avoid "nonce too low" errors
        });
        usdcAmount = swapResult.tx.buyAmount || swapResult.tx.dstAmount || "0";
        console.log(`[Swap Token] ✅ 0x swap transaction sent: ${txHash}`);
        console.log(`[Swap Token] 💰 Cost: ~$0.60 ETH (traditional gas)`);
      }

      // ========================================================================
      // STEP 4: Wait for transaction confirmation
      // ========================================================================
      console.log(`[Swap Token] ⏳ Waiting for transaction confirmation...`);
      let receipt;
      try {
        receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 120_000, // 2 minute timeout
        });
      } catch (error: any) {
        console.error(`[Swap Token] ❌ Transaction receipt not found or timeout: ${error.message}`);
        console.error(`[Swap Token] Transaction hash: ${txHash}`);
        
        // Update status back to token_received since swap didn't confirm
        await supabaseAdmin
          .from("offramp_transactions")
          .update({
            status: "token_received",
            error_message: `Swap transaction sent but not confirmed: ${txHash}. Error: ${error.message}`,
            updated_at: new Date().toISOString(),
          })
          .eq("transaction_id", transactionId);

        return NextResponse.json(
          {
            success: false,
            message: "Swap transaction sent but not confirmed on-chain",
            txHash: txHash,
            error: error.message,
          },
          { status: 500 }
        );
      }

      console.log(`[Swap Token] 📋 Receipt received - Status: ${receipt.status}`);
      console.log(`[Swap Token] 📋 Transaction Hash: https://basescan.org/tx/${txHash}`);
      console.log(`[Swap Token] 📋 Gas Used: ${receipt.gasUsed.toString()}`);
      console.log(`[Swap Token] 📋 Block: ${receipt.blockNumber.toString()}`);
      
      if (receipt.status !== "success") {
        // Transaction reverted! Log detailed info
        console.error(`[Swap Token] ❌ TRANSACTION REVERTED ON-CHAIN!`);
        console.error(`[Swap Token] Transaction: https://basescan.org/tx/${txHash}`);
        console.error(`[Swap Token] Provider: ${swapResult.provider}`);
        console.error(`[Swap Token] Layer: ${swapResult.layerUsed}`);
        console.error(`[Swap Token] Check BaseScan for revert reason.`);
        
        throw new Error(`Transaction reverted on-chain. View details: https://basescan.org/tx/${txHash}`);
      }
      
      if (receipt.status === "success") {
        // USDC amount already extracted above based on provider
        const usdcAmountFormatted = formatUnits(BigInt(usdcAmount), 6); // USDC has 6 decimals
        
        // Update transaction with swap info (including which layer/provider was used)
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

        // Record swap attempt with provider info
        await supabaseAdmin.from("offramp_swap_attempts").insert({
          transaction_id: transactionId,
          attempt_number: (transaction.swap_attempts || 0) + 1,
          swap_tx_hash: txHash,
          status: "success",
        });

        console.log(`[Swap Token] ✅ Swap successful using ${swapResult.provider} (Layer ${swapResult.layerUsed})`);
        console.log(`[Swap Token] ✅ USDC received: ${usdcAmountFormatted}`);
        
        // Note: For Aerodrome swaps, USDC is sent directly to receiver wallet
        // For 0x swaps, USDC is sent to unique wallet first, then we transfer it
        
        // ====================================================================
        // STEP 5: Transfer USDC from unique wallet to receiver wallet (if needed)
        // ====================================================================
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

            // Get current nonce for USDC transfer
            const transferNonce = await publicClient.getTransactionCount({
              address: wallet.address as `0x${string}`,
            });
            console.log(`[Swap Token] Current nonce for USDC transfer: ${transferNonce}`);

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
              nonce: transferNonce, // Explicitly set nonce to avoid "nonce too low" errors
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

            // ====================================================================
            // STEP 5: Automatically trigger payment processing (USDC → NGN → Paystack)
            // ====================================================================
            console.log(`[Swap Token] 💰 Automatically triggering payment processing...`);
            try {
              const paymentResponse = await fetch(`${request.nextUrl.origin}/api/offramp/process-payment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ transactionId }),
              });

              const paymentData = await paymentResponse.json();
              
              if (paymentData.success) {
                console.log(`[Swap Token] ✅ Payment processed successfully!`);
                console.log(`[Swap Token] 💵 NGN Amount: ${paymentData.ngnAmount}`);
                console.log(`[Swap Token] 📊 Paystack Reference: ${paymentData.paystackReference}`);
              } else {
                console.error(`[Swap Token] ⚠️ Payment processing failed: ${paymentData.message}`);
                // Don't fail the swap - payment can be retried manually
              }
            } catch (paymentError: any) {
              console.error(`[Swap Token] ⚠️ Error triggering payment: ${paymentError.message}`);
              // Don't fail the swap - payment can be retried manually
            }
          } else {
            console.warn(`[Swap Token] ⚠️ No USDC balance found in unique wallet after swap`);
            console.log(`[Swap Token] ℹ️  USDC likely sent directly to receiver wallet (Aerodrome behavior)`);
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
        
        // ====================================================================
        // STEP 6: Recover ALL remaining ETH to master wallet (ALWAYS)
        // ====================================================================
        try {
          const remainingETH = await publicClient.getBalance({
            address: wallet.address as `0x${string}`,
          });

          // Recover ALL ETH, even if very small amounts
          // Only skip if balance is truly zero or would cost more in gas than value
          if (remainingETH > 0n) {
            const masterWallet = getMasterWallet();
            const ethAmount = formatEther(remainingETH);
            console.log(`[Swap Token] 💰 Recovering remaining ETH (${ethAmount} ETH) to master wallet: ${masterWallet.address}`);

            // Estimate gas cost for transfer
            const gasEstimate = await publicClient.estimateGas({
              account: account,
              to: masterWallet.address as `0x${string}`,
              value: remainingETH,
            });

            const gasPrice = await publicClient.getGasPrice();
            const gasCost = gasEstimate * gasPrice;

            // Only recover if we have enough to cover gas + leave tiny buffer
            // If not enough, it's not worth recovering (gas cost > value)
            if (remainingETH > gasCost + parseEther("0.00001")) {
              const ethToSend = remainingETH - gasCost - parseEther("0.00001"); // Leave tiny buffer
              
              if (ethToSend > 0n) {
                const ethTransferHash = await walletClient.sendTransaction({
                  to: masterWallet.address as `0x${string}`,
                  value: ethToSend,
                });

                await publicClient.waitForTransactionReceipt({ hash: ethTransferHash });
                console.log(`[Swap Token] ✅ Recovered ${formatEther(ethToSend)} ETH to master wallet`);
                console.log(`[Swap Token] 📊 TX Hash: ${ethTransferHash}`);
              } else {
                console.log(`[Swap Token] ⚠️  ETH balance too small to recover (gas cost exceeds value)`);
              }
            } else {
              console.log(`[Swap Token] ⚠️  ETH balance too small to recover (gas cost: ${formatEther(gasCost)}, balance: ${ethAmount})`);
            }
          } else {
            console.log(`[Swap Token] ℹ️  No ETH remaining to recover`);
          }
        } catch (error: any) {
          console.error("[Swap Token] Error sending remaining ETH:", error);
          // Don't fail the whole transaction if this fails
        }

        // ====================================================================
        // STEP 7: Automatically trigger payment processing (if not already triggered)
        // ====================================================================
        // Check if payment was already processed (from USDC transfer step)
        const { data: updatedTx } = await supabaseAdmin
          .from("offramp_transactions")
          .select("status, paystack_reference")
          .eq("transaction_id", transactionId)
          .single();

        // Only trigger payment if status is still usdc_received (not already completed)
        if (updatedTx && updatedTx.status === "usdc_received" && !updatedTx.paystack_reference) {
          console.log(`[Swap Token] 💰 Triggering payment processing (USDC → NGN → Paystack)...`);
          try {
            const paymentResponse = await fetch(`${request.nextUrl.origin}/api/offramp/process-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transactionId }),
            });

            const paymentData = await paymentResponse.json();
            
            if (paymentData.success) {
              console.log(`[Swap Token] ✅ Payment processed successfully!`);
              console.log(`[Swap Token] 💵 NGN Amount: ${paymentData.ngnAmount}`);
              console.log(`[Swap Token] 📊 Paystack Reference: ${paymentData.paystackReference}`);
            } else {
              console.error(`[Swap Token] ⚠️ Payment processing failed: ${paymentData.message}`);
              // Don't fail the swap - payment can be retried manually via admin dashboard
            }
          } catch (paymentError: any) {
            console.error(`[Swap Token] ⚠️ Error triggering payment: ${paymentError.message}`);
            // Don't fail the swap - payment can be retried manually
          }
        } else if (updatedTx?.status === "completed") {
          console.log(`[Swap Token] ✅ Payment already processed`);
        }
        
        return NextResponse.json({
          success: true,
          swapTxHash: txHash,
          usdcAmount: usdcAmountFormatted,
          provider: swapResult.provider,
          layerUsed: swapResult.layerUsed,
          gasRequired: swapResult.gasRequired,
          message: `Swap successful using ${swapResult.provider} (Layer ${swapResult.layerUsed})`,
        });
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error: any) {
      const errorMessage = error.message || "Swap transaction failed";
      const errorDetails = error.details || error.cause || "No additional details";
      
      console.error("[Swap Token] ❌ Error executing swap:", errorMessage);
      console.error("[Swap Token] Error details:", errorDetails);
      console.error("[Swap Token] Full error:", error);
      
      // Update transaction with error
      await supabaseAdmin
        .from("offramp_transactions")
        .update({
          status: "token_received",
          error_message: `${errorMessage} | Details: ${JSON.stringify(errorDetails)}`,
          swap_attempts: (transaction.swap_attempts || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("transaction_id", transactionId);

      // Record failed swap attempt
      await supabaseAdmin.from("offramp_swap_attempts").insert({
        transaction_id: transactionId,
        attempt_number: (transaction.swap_attempts || 0) + 1,
        status: "failed",
        error_message: errorMessage,
      });

      return NextResponse.json(
        {
          success: false,
          message: errorMessage,
          details: errorDetails,
          error: error.shortMessage || error.message,
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
