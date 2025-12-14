/**
 * Test off-ramp system with a specific wallet
 * Usage: npx tsx scripts/test-offramp-wallet.ts <walletAddress>
 */

import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL, SEND_TOKEN_ADDRESS } from "../lib/constants";

const walletAddress = process.argv[2] || "0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2";
const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Get admin wallet from env
const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLETS?.split(",")[0] || "";

async function testWallet() {
  console.log(`\n🧪 Testing Off-Ramp System`);
  console.log(`==========================\n`);
  console.log(`Wallet Address: ${walletAddress}\n`);

  // 1. Check wallet balance
  console.log(`1️⃣ Checking wallet balance...\n`);
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });

  try {
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

    const balanceFormatted = formatUnits(balance, 18);
    console.log(`✅ SEND Token Balance: ${balanceFormatted} SEND`);
    console.log(`   Raw Balance: ${balance.toString()}\n`);

    if (balance === BigInt(0)) {
      console.log("❌ No SEND tokens found in this wallet\n");
      return;
    }

    // 2. Check ETH balance
    const ethBalance = await publicClient.getBalance({
      address: walletAddress.toLowerCase() as `0x${string}`,
    });
    console.log(`⛽ ETH Balance: ${formatUnits(ethBalance, 18)} ETH\n`);

    // 3. Find transaction in database
    console.log(`2️⃣ Finding transaction in database...\n`);
    
    if (!ADMIN_WALLET) {
      console.log("⚠️  ADMIN_WALLET not set. Cannot query database.");
      console.log("   Please set NEXT_PUBLIC_ADMIN_WALLETS in .env.local\n");
      return;
    }

    const listResponse = await fetch(`${API_URL}/api/admin/offramp?adminWallet=${ADMIN_WALLET}&status=all`);
    const listData = await listResponse.json();

    if (!listData.success) {
      console.error(`❌ Failed to fetch transactions: ${listData.error}\n`);
      return;
    }

    const transactions = listData.transactions || [];
    const matchingTx = transactions.find(
      (tx: any) => tx.unique_wallet_address?.toLowerCase() === walletAddress.toLowerCase()
    );

    if (matchingTx) {
      console.log(`✅ Found transaction:`);
      console.log(`   Transaction ID: ${matchingTx.transaction_id}`);
      console.log(`   Status: ${matchingTx.status}`);
      console.log(`   Token: ${matchingTx.token_symbol || "Not detected"} ${matchingTx.token_amount || ""}`);
      console.log(`   User: ${matchingTx.user_email}`);
      console.log(`   Account: ${matchingTx.user_account_number}\n`);

      // 4. Trigger swap using restart-by-wallet
      console.log(`3️⃣ Triggering swap process...\n`);
      
      const restartResponse = await fetch(`${API_URL}/api/admin/offramp/restart-by-wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminWallet: ADMIN_WALLET,
          walletAddress: walletAddress,
        }),
      });

      const restartData = await restartResponse.json();

      if (restartData.success) {
        console.log(`✅ Swap Process Started!\n`);
        console.log(`   Transaction ID: ${restartData.transactionId}`);
        console.log(`   Swap TX: ${restartData.swapTxHash || "Processing..."}`);
        console.log(`   USDC Amount: ${restartData.usdcAmount || "Calculating..."}`);
        console.log(`\n${restartData.details || ""}\n`);
      } else {
        console.error(`❌ Error: ${restartData.error}`);
        if (restartData.hint) {
          console.error(`   Hint: ${restartData.hint}`);
        }
        if (restartData.swapError) {
          console.error(`   Swap Error: ${restartData.swapError}`);
        }
        console.log("");
      }
    } else {
      console.log(`⚠️  No transaction found for this wallet address`);
      console.log(`\n💡 Options:`);
      console.log(`   1. Create a new transaction via the frontend (/offramp)`);
      console.log(`   2. Or use manual-swap endpoint to create and swap\n`);
      
      // Try manual swap which can create transaction if needed
      console.log(`4️⃣ Trying manual swap (will create transaction if needed)...\n`);
      
      const manualSwapResponse = await fetch(`${API_URL}/api/admin/offramp/manual-swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminWallet: ADMIN_WALLET,
          walletAddress: walletAddress,
          tokenAmount: balanceFormatted,
          tokenAmountRaw: balance.toString(),
        }),
      });

      const manualSwapData = await manualSwapResponse.json();

      if (manualSwapData.success) {
        console.log(`✅ Manual Swap Triggered!\n`);
        console.log(`   Transaction ID: ${manualSwapData.transactionId}`);
        console.log(`   Wallet: ${manualSwapData.walletAddress}`);
        console.log(`   Swap Result:`, JSON.stringify(manualSwapData.swapResult, null, 2));
        console.log("");
      } else {
        console.error(`❌ Manual Swap Failed: ${manualSwapData.error}\n`);
      }
    }

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    console.log("");
  }
}

testWallet();

