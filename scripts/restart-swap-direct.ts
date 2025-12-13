/**
 * Direct script to restart and swap for wallet 0xCadCda9Ae9f84B865c18dF5af43E60CaE0b31A52
 * This bypasses the API and directly calls the swap process
 */

import { supabaseAdmin } from "../lib/supabase";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL, SEND_TOKEN_ADDRESS } from "../lib/constants";

const walletAddress = "0xCadCda9Ae9f84B865c18dF5af43E60CaE0b31A52";

async function restartAndSwap() {
  try {
    console.log(`\n🔍 Finding transaction for wallet: ${walletAddress}\n`);

    // Find transaction by wallet address
    const { data: transaction, error } = await supabaseAdmin
      .from("offramp_transactions")
      .select("*")
      .eq("unique_wallet_address", walletAddress.toLowerCase())
      .single();

    if (error || !transaction) {
      console.error(`❌ Transaction not found for wallet: ${walletAddress}`);
      console.error(`Error:`, error);
      return;
    }

    console.log(`✅ Found transaction: ${transaction.transaction_id}`);
    console.log(`   Status: ${transaction.status}`);
    console.log(`   Token: ${transaction.token_symbol || "N/A"} ${transaction.token_amount || "N/A"}`);
    console.log(`   Wallet: ${transaction.unique_wallet_address}\n`);

    // Check if token is already detected
    if (!transaction.token_address || !transaction.token_amount_raw) {
      console.log(`📊 Checking wallet for tokens...\n`);
      
      const publicClient = createPublicClient({
        chain: base,
        transport: http(BASE_RPC_URL),
      });

      const balance = (await publicClient.readContract({
        address: SEND_TOKEN_ADDRESS as `0x${string}`,
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
        args: [walletAddress.toLowerCase() as `0x${string}`],
      })) as bigint;

      if (balance > BigInt(0)) {
        const decimals = 18;
        const amount = formatUnits(balance, decimals);
        
        console.log(`✅ Found ${amount} SEND tokens in wallet\n`);
        
        // Update transaction with token info
        await supabaseAdmin
          .from("offramp_transactions")
          .update({
            token_address: SEND_TOKEN_ADDRESS,
            token_symbol: "SEND",
            token_amount: amount,
            token_amount_raw: balance.toString(),
            status: "token_received",
            token_received_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("transaction_id", transaction.transaction_id);
      } else {
        console.error(`❌ No tokens found in wallet`);
        return;
      }
    }

    // Now trigger swap via API
    console.log(`🔄 Triggering swap process...\n`);
    
    const swapResponse = await fetch("http://localhost:3000/api/offramp/swap-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId: transaction.transaction_id }),
    });

    const swapData = await swapResponse.json();

    if (swapData.success) {
      console.log(`✅ Swap Completed!\n`);
      console.log(`   Transaction ID: ${transaction.transaction_id}`);
      console.log(`   Swap TX: ${swapData.swapTxHash || "Processing..."}`);
      console.log(`   USDC Amount: ${swapData.usdcAmount || "Calculating..."}`);
      console.log(`   ${swapData.message || ""}\n`);
    } else {
      console.error(`❌ Swap Failed: ${swapData.message || swapData.error}`);
      if (swapData.error) {
        console.error(`   Details: ${swapData.error}`);
      }
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error);
  }
}

restartAndSwap();

