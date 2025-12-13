/**
 * Wallet Emptier Utility
 * Handles complete wallet emptying: swap all tokens to USDC, transfer to master wallet, recover ETH
 */

import { createWalletClient, createPublicClient, http, formatUnits, parseEther, formatEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { BASE_RPC_URL } from "./constants";
import { scanWalletForAllTokens, checkGasBalance, TokenInfo } from "./wallet-scanner";
import { getSwapTransaction, USDC_BASE_ADDRESS as USDC_ADDRESS, ZEROX_EXCHANGE_PROXY } from "./0x-swap";
import { getMasterWallet, getReceiverWalletAddress } from "./offramp-wallet";

/**
 * Result of emptying a wallet
 */
export interface EmptyWalletResult {
  success: boolean;
  tokensFound: TokenInfo[];
  tokensSwapped: number;
  totalUSDCReceived: string;
  ethRecovered: string;
  walletEmpty: boolean;
  errors: string[];
  swapTxHashes: string[];
}

/**
 * Empty a wallet completely:
 * 1. Scan for all tokens
 * 2. Fund gas if needed
 * 3. Swap all tokens to USDC
 * 4. Transfer USDC to receiver wallet
 * 5. Recover all ETH to master wallet
 */
export async function emptyWallet(
  walletAddress: string,
  walletPrivateKey: string
): Promise<EmptyWalletResult> {
  const result: EmptyWalletResult = {
    success: false,
    tokensFound: [],
    tokensSwapped: 0,
    totalUSDCReceived: "0",
    ethRecovered: "0",
    walletEmpty: false,
    errors: [],
    swapTxHashes: [],
  };

  try {
    // Create clients
    const account = privateKeyToAccount(walletPrivateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    const publicClient = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    // 1. Scan for all tokens
    console.log(`[Wallet Emptier] Scanning wallet ${walletAddress} for all tokens...`);
    const tokens = await scanWalletForAllTokens(walletAddress);
    result.tokensFound = tokens;

    if (tokens.length === 0) {
      console.log(`[Wallet Emptier] No tokens found in wallet ${walletAddress}`);
      result.success = true;
      result.walletEmpty = true;
      return result;
    }

    console.log(`[Wallet Emptier] Found ${tokens.length} token(s):`, tokens.map(t => `${t.symbol} (${t.amount})`));

    // 2. Check and fund gas if needed
    const minETHRequired = parseEther("0.0002"); // Minimum for approval + swap
    const gasCheck = await checkGasBalance(walletAddress, minETHRequired);

    if (!gasCheck.hasEnough) {
      console.log(`[Wallet Emptier] Wallet has insufficient gas (${formatEther(gasCheck.balance)} ETH). Funding from master wallet...`);
      
      const masterWallet = getMasterWallet();
      const masterAccount = privateKeyToAccount(masterWallet.privateKey as `0x${string}`);
      const masterWalletClient = createWalletClient({
        account: masterAccount,
        chain: base,
        transport: http(BASE_RPC_URL),
      });

      const masterBalance = await publicClient.getBalance({
        address: masterWallet.address as `0x${string}`,
      });

      const masterReserve = parseEther("0.00002");
      const availableToSend = masterBalance > masterReserve ? masterBalance - masterReserve : BigInt(0);

      if (availableToSend <= 0) {
        result.errors.push(`Master wallet has insufficient ETH. Balance: ${formatEther(masterBalance)} ETH`);
        return result;
      }

      const ethAmount = availableToSend > minETHRequired ? minETHRequired : availableToSend;
      
      const ethTxHash = await masterWalletClient.sendTransaction({
        to: walletAddress as `0x${string}`,
        value: ethAmount,
      });

      await publicClient.waitForTransactionReceipt({ hash: ethTxHash });
      console.log(`[Wallet Emptier] ✅ Funded wallet with ${formatEther(ethAmount)} ETH`);
    }

    // 3. Swap all tokens to USDC
    let totalUSDC = BigInt(0);
    const receiverWallet = getReceiverWalletAddress();

    for (const token of tokens) {
      // Skip ETH for now (we'll handle it separately)
      if (!token.address) {
        continue;
      }

      // Skip USDC (already USDC, just transfer it)
      if (token.address.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
        console.log(`[Wallet Emptier] Token is already USDC, transferring directly...`);
        
        try {
          const usdcBalance = BigInt(token.amountRaw);
          if (usdcBalance > 0n) {
            const transferHash = await walletClient.writeContract({
              address: USDC_ADDRESS as `0x${string}`,
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

            await publicClient.waitForTransactionReceipt({ hash: transferHash });
            totalUSDC += usdcBalance;
            result.tokensSwapped++;
            result.swapTxHashes.push(transferHash);
            console.log(`[Wallet Emptier] ✅ Transferred ${token.amount} USDC to receiver wallet`);
          }
        } catch (error: any) {
          result.errors.push(`Failed to transfer USDC: ${error.message}`);
          console.error(`[Wallet Emptier] Error transferring USDC:`, error);
        }
        continue;
      }

      // Swap token to USDC
      console.log(`[Wallet Emptier] Swapping ${token.symbol} (${token.amount}) to USDC...`);
      
      try {
        // Check allowance for ERC20 tokens
        const allowance = (await publicClient.readContract({
          address: token.address as `0x${string}`,
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
          args: [walletAddress as `0x${string}`, ZEROX_EXCHANGE_PROXY as `0x${string}`],
        })) as bigint;

        const amountBigInt = BigInt(token.amountRaw);
        
        if (allowance < amountBigInt) {
          console.log(`[Wallet Emptier] Approving ${token.symbol} for swap...`);
          const maxApproval = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
          
          const approveHash = await walletClient.writeContract({
            address: token.address as `0x${string}`,
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

          await publicClient.waitForTransactionReceipt({ hash: approveHash });
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for state sync
        }

        // Get swap transaction from 0x
        const swapResult = await getSwapTransaction(
          token.address,
          USDC_ADDRESS,
          token.amountRaw,
          walletAddress, // USDC goes to wallet first, then we transfer
          1 // 1% slippage
        );

        if (!swapResult.success || !swapResult.tx) {
          result.errors.push(`Failed to get swap transaction for ${token.symbol}: ${swapResult.error}`);
          console.error(`[Wallet Emptier] Swap failed for ${token.symbol}:`, swapResult.error);
          continue;
        }

        // Execute swap
        const swapTxHash = await walletClient.sendTransaction({
          to: swapResult.tx.to as `0x${string}`,
          data: swapResult.tx.data as `0x${string}`,
          value: swapResult.tx.value ? BigInt(swapResult.tx.value) : BigInt(0),
          gas: swapResult.tx.gas ? BigInt(swapResult.tx.gas) : undefined,
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash: swapTxHash });
        
        if (receipt.status === "success") {
          const usdcAmount = swapResult.tx.buyAmount || swapResult.tx.dstAmount || "0";
          totalUSDC += BigInt(usdcAmount);
          result.tokensSwapped++;
          result.swapTxHashes.push(swapTxHash);
          console.log(`[Wallet Emptier] ✅ Swapped ${token.symbol} to USDC. Received: ${formatUnits(BigInt(usdcAmount), 6)} USDC`);
        } else {
          result.errors.push(`Swap transaction failed for ${token.symbol}`);
        }
      } catch (error: any) {
        result.errors.push(`Error swapping ${token.symbol}: ${error.message}`);
        console.error(`[Wallet Emptier] Error swapping ${token.symbol}:`, error);
      }
    }

    // 4. Handle ETH (swap to USDC if there's enough, otherwise just recover)
    const ethToken = tokens.find(t => !t.address);
    if (ethToken) {
      const ethBalance = BigInt(ethToken.amountRaw);
      const minETHForSwap = parseEther("0.001"); // Need some ETH for gas, so only swap if we have more than this
      
      if (ethBalance > minETHForSwap) {
        // Swap ETH to USDC (leave some for gas)
        const ethToSwap = ethBalance - parseEther("0.0001"); // Leave 0.0001 ETH for gas
        
        try {
          console.log(`[Wallet Emptier] Swapping ETH (${formatEther(ethToSwap)}) to USDC...`);
          
          const swapResult = await getSwapTransaction(
            null, // ETH
            USDC_ADDRESS,
            ethToSwap.toString(),
            walletAddress,
            1
          );

          if (swapResult.success && swapResult.tx) {
            const swapTxHash = await walletClient.sendTransaction({
              to: swapResult.tx.to as `0x${string}`,
              data: swapResult.tx.data as `0x${string}`,
              value: BigInt(swapResult.tx.value || "0"),
              gas: swapResult.tx.gas ? BigInt(swapResult.tx.gas) : undefined,
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash: swapTxHash });
            
            if (receipt.status === "success") {
              const usdcAmount = swapResult.tx.buyAmount || swapResult.tx.dstAmount || "0";
              totalUSDC += BigInt(usdcAmount);
              result.tokensSwapped++;
              result.swapTxHashes.push(swapTxHash);
              console.log(`[Wallet Emptier] ✅ Swapped ETH to USDC. Received: ${formatUnits(BigInt(usdcAmount), 6)} USDC`);
            }
          }
        } catch (error: any) {
          result.errors.push(`Error swapping ETH: ${error.message}`);
          console.error(`[Wallet Emptier] Error swapping ETH:`, error);
        }
      }
    }

    // 5. Transfer all USDC to receiver wallet
    if (totalUSDC > 0n) {
      try {
        const currentUSDCBalance = (await publicClient.readContract({
          address: USDC_ADDRESS as `0x${string}`,
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
          args: [walletAddress as `0x${string}`],
        })) as bigint;

        if (currentUSDCBalance > 0n) {
          console.log(`[Wallet Emptier] Transferring ${formatUnits(currentUSDCBalance, 6)} USDC to receiver wallet...`);
          
          const usdcTransferHash = await walletClient.writeContract({
            address: USDC_ADDRESS as `0x${string}`,
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
            args: [receiverWallet as `0x${string}`, currentUSDCBalance],
          });

          await publicClient.waitForTransactionReceipt({ hash: usdcTransferHash });
          result.totalUSDCReceived = formatUnits(currentUSDCBalance, 6);
          console.log(`[Wallet Emptier] ✅ Transferred ${result.totalUSDCReceived} USDC to receiver wallet`);
        }
      } catch (error: any) {
        result.errors.push(`Error transferring USDC: ${error.message}`);
        console.error(`[Wallet Emptier] Error transferring USDC:`, error);
      }
    }

    // 6. Recover all remaining ETH to master wallet
    try {
      const remainingETH = await publicClient.getBalance({
        address: walletAddress as `0x${string}`,
      });

      const minETHToRecover = parseEther("0.0001");
      if (remainingETH > minETHToRecover) {
        const masterWallet = getMasterWallet();
        const ethToRecover = remainingETH - parseEther("0.00001"); // Leave tiny amount for safety
        
        console.log(`[Wallet Emptier] Recovering ${formatEther(ethToRecover)} ETH to master wallet...`);
        
        const ethRecoverHash = await walletClient.sendTransaction({
          to: masterWallet.address as `0x${string}`,
          value: ethToRecover,
        });

        await publicClient.waitForTransactionReceipt({ hash: ethRecoverHash });
        result.ethRecovered = formatEther(ethToRecover);
        console.log(`[Wallet Emptier] ✅ Recovered ${result.ethRecovered} ETH to master wallet`);
      }
    } catch (error: any) {
      result.errors.push(`Error recovering ETH: ${error.message}`);
      console.error(`[Wallet Emptier] Error recovering ETH:`, error);
    }

    // 7. Verify wallet is empty
    const finalTokens = await scanWalletForAllTokens(walletAddress);
    const finalETH = await publicClient.getBalance({
      address: walletAddress as `0x${string}`,
    });

    result.walletEmpty = finalTokens.length === 0 && finalETH < parseEther("0.00001");
    result.success = result.walletEmpty && result.errors.length === 0;

    if (result.walletEmpty) {
      console.log(`[Wallet Emptier] ✅ Wallet ${walletAddress} is now empty`);
    } else {
      console.warn(`[Wallet Emptier] ⚠️ Wallet ${walletAddress} still has tokens or ETH`);
    }

    return result;
  } catch (error: any) {
    result.errors.push(`Fatal error: ${error.message}`);
    console.error(`[Wallet Emptier] Fatal error:`, error);
    return result;
  }
}
