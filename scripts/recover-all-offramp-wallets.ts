/**
 * Recover all tokens from ALL offramp wallets
 * This will transfer all tokens to the specified receiver wallet
 */

import { readFileSync } from "fs";
import { join } from "path";

// Load .env.local
const envPath = join(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  const lines = envContent.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
        process.env[key.trim()] = value;
      }
    }
  }
  console.log("✅ Loaded .env.local");
} catch (error) {
  console.error("⚠️  Could not read .env.local file.");
}

import { createWalletClient, createPublicClient, http, formatUnits, parseEther, formatEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { BASE_RPC_URL } from "../lib/constants";
import { scanWalletForAllTokens } from "../lib/wallet-scanner";
import { generateUserOfframpWallet, generateOfframpWallet, getReceiverWalletAddress, getMasterWallet } from "../lib/offramp-wallet";
import { supabaseAdmin } from "../lib/supabase";

const ERC20_ABI = [
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
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
] as const;

interface RecoveryResult {
  walletAddress: string;
  success: boolean;
  privateKeyFound: boolean;
  tokensFound: number;
  tokensTransferred: number;
  totalAmounts: Record<string, string>;
  ethRecovered: string;
  errors: string[];
  txHashes: string[];
}

async function findWalletPrivateKey(walletAddress: string): Promise<{ privateKey: string; source: string } | null> {
  console.log(`\n🔑 Deriving private key for ${walletAddress}...`);

  // Try to find transaction in database
  const { data: transactions } = await supabaseAdmin
    .from("offramp_transactions")
    .select("*")
    .eq("unique_wallet_address", walletAddress.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(10);

  if (transactions && transactions.length > 0) {
    console.log(`   📋 Found ${transactions.length} transaction(s)`);

    for (const tx of transactions) {
      // Try old transaction-based method
      try {
        const oldWallet = generateOfframpWallet(tx.transaction_id);
        if (oldWallet.address.toLowerCase() === walletAddress.toLowerCase()) {
          console.log(`   ✅ Old method (tx-based)`);
          return { privateKey: oldWallet.privateKey, source: "old_tx" };
        }
      } catch (error) {}

      // Try new user-based method
      try {
        const userIdentifier = tx.user_id || tx.user_email || `guest_${tx.user_account_number}`;
        const newWallet = generateUserOfframpWallet(userIdentifier);
        if (newWallet.address.toLowerCase() === walletAddress.toLowerCase()) {
          console.log(`   ✅ New method (user-based)`);
          return { privateKey: newWallet.privateKey, source: "new_user" };
        }
      } catch (error) {}
    }
  }

  console.log(`   ❌ Could not derive private key`);
  return null;
}

async function recoverWallet(walletAddress: string, receiverWallet: string): Promise<RecoveryResult> {
  const result: RecoveryResult = {
    walletAddress,
    success: false,
    privateKeyFound: false,
    tokensFound: 0,
    tokensTransferred: 0,
    totalAmounts: {},
    ethRecovered: "0",
    errors: [],
    txHashes: [],
  };

  try {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🔄 Processing: ${walletAddress}`);
    console.log(`${"=".repeat(60)}`);

    // 1. Scan for tokens
    const tokens = await scanWalletForAllTokens(walletAddress);
    result.tokensFound = tokens.length;

    if (tokens.length === 0) {
      const publicClient = createPublicClient({
        chain: base,
        transport: http(BASE_RPC_URL),
      });

      const ethBalance = await publicClient.getBalance({
        address: walletAddress as `0x${string}`,
      });

      if (ethBalance === BigInt(0)) {
        console.log(`   ✅ Already empty`);
        result.success = true;
        return result;
      } else {
        console.log(`   ⚠️  No tokens, but has ${formatEther(ethBalance)} ETH`);
      }
    } else {
      console.log(`   ✅ Found ${tokens.length} token(s):`);
      tokens.forEach((token, i) => {
        console.log(`      ${i + 1}. ${token.symbol}: ${token.amount}`);
      });
    }

    // 2. Find private key
    const keyResult = await findWalletPrivateKey(walletAddress);

    if (!keyResult) {
      result.errors.push("Could not derive private key");
      console.log(`   ❌ Cannot proceed without private key`);
      return result;
    }

    result.privateKeyFound = true;

    // 3. Create clients
    const account = privateKeyToAccount(keyResult.privateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    const publicClient = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    });

    // 4. Transfer ERC20 tokens
    const erc20Tokens = tokens.filter((t) => t.address !== null && t.symbol !== "ETH");
    
    if (erc20Tokens.length > 0) {
      console.log(`\n💸 Transferring ${erc20Tokens.length} token(s)...`);

      // Check gas
      const ethBalance = await publicClient.getBalance({
        address: walletAddress as `0x${string}`,
      });

      const minGasRequired = parseEther("0.0001");
      if (ethBalance < minGasRequired) {
        console.log(`   ⚠️  Funding gas...`);
        
        const masterWallet = getMasterWallet();
        const masterAccount = privateKeyToAccount(masterWallet.privateKey as `0x${string}`);
        const masterWalletClient = createWalletClient({
          account: masterAccount,
          chain: base,
          transport: http(BASE_RPC_URL),
        });

        const ethAmount = parseEther("0.0002");
        const fundTxHash = await masterWalletClient.sendTransaction({
          to: walletAddress as `0x${string}`,
          value: ethAmount,
        });

        await publicClient.waitForTransactionReceipt({ hash: fundTxHash });
        console.log(`   ✅ Gas funded`);
      }

      // Transfer each token
      for (const token of erc20Tokens) {
        try {
          if (!token.address) continue;

          const balance = BigInt(token.amountRaw);
          console.log(`\n   📤 ${token.symbol} (${token.amount})...`);

          const txHash = await walletClient.writeContract({
            address: token.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [receiverWallet as `0x${string}`, balance],
          });

          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          
          if (receipt.status === "success") {
            console.log(`      ✅ Transferred`);
            result.tokensTransferred++;
            result.totalAmounts[token.symbol] = token.amount;
            result.txHashes.push(txHash);
          } else {
            result.errors.push(`${token.symbol} transfer failed`);
          }
        } catch (error: any) {
          result.errors.push(`Error: ${token.symbol}`);
          console.error(`      ❌ Error: ${error.message}`);
        }
      }
    }

    // 5. Recover ETH to master wallet
    console.log(`\n💰 Recovering ETH...`);
    try {
      const remainingETH = await publicClient.getBalance({
        address: walletAddress as `0x${string}`,
      });

      const minETHToRecover = parseEther("0.0001");
      if (remainingETH > minETHToRecover) {
        const masterWallet = getMasterWallet();
        const ethToRecover = remainingETH - parseEther("0.00001");
        
        const ethTxHash = await walletClient.sendTransaction({
          to: masterWallet.address as `0x${string}`,
          value: ethToRecover,
        });

        await publicClient.waitForTransactionReceipt({ hash: ethTxHash });
        result.ethRecovered = formatEther(ethToRecover);
        result.txHashes.push(ethTxHash);
        console.log(`   ✅ Recovered ${result.ethRecovered} ETH`);
      }
    } catch (error: any) {
      result.errors.push(`ETH recovery error: ${error.message}`);
    }

    result.success = result.errors.length === 0;
    
    if (result.success) {
      console.log(`\n   ✅ Complete!`);
    } else {
      console.log(`\n   ⚠️  Completed with errors`);
    }

    return result;
  } catch (error: any) {
    result.errors.push(error.message || "Unknown error");
    console.error(`   ❌ Error: ${error.message}`);
    return result;
  }
}

async function main() {
  console.log(`\n${"#".repeat(60)}`);
  console.log(`🚀 All Offramp Wallets Recovery`);
  console.log(`${"#".repeat(60)}\n`);

  // Get receiver wallet
  const receiverWalletArg = process.argv[2];
  let receiverWallet: string;
  
  try {
    receiverWallet = receiverWalletArg || getReceiverWalletAddress();
  } catch (error) {
    if (!receiverWalletArg) {
      console.error(`\n❌ Error: Receiver wallet not set`);
      console.error(`   Usage: npx tsx scripts/recover-all-offramp-wallets.ts <receiver_wallet>\n`);
      process.exit(1);
    }
    receiverWallet = receiverWalletArg;
  }

  console.log(`📬 Receiver wallet: ${receiverWallet}\n`);

  // Get all wallets from database
  console.log(`📋 Fetching wallets from database...`);
  const { data: transactions, error } = await supabaseAdmin
    .from('offramp_transactions')
    .select('unique_wallet_address')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`❌ Database error:`, error);
    process.exit(1);
  }

  if (!transactions || transactions.length === 0) {
    console.log(`No offramp transactions found.`);
    return;
  }

  const wallets = [...new Set(transactions.map(t => t.unique_wallet_address))];
  console.log(`✅ Found ${wallets.length} unique wallets\n`);

  const results: RecoveryResult[] = [];

  for (const wallet of wallets) {
    const result = await recoverWallet(wallet, receiverWallet);
    results.push(result);

    // Wait between wallets
    if (wallet !== wallets[wallets.length - 1]) {
      console.log(`\n⏳ Waiting 3 seconds...`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  // Summary
  console.log(`\n${"#".repeat(60)}`);
  console.log(`📊 Recovery Summary`);
  console.log(`${"#".repeat(60)}\n`);

  let totalSuccess = 0;
  let totalTokensTransferred = 0;
  let totalAmounts: Record<string, number> = {};
  let totalETH = 0;

  results.forEach((result, i) => {
    const status = result.success ? "✅" : "❌";
    console.log(`${status} ${i + 1}. ${result.walletAddress}`);
    console.log(`   Tokens Found: ${result.tokensFound}`);
    console.log(`   Tokens Transferred: ${result.tokensTransferred}`);
    if (Object.keys(result.totalAmounts).length > 0) {
      Object.entries(result.totalAmounts).forEach(([symbol, amount]) => {
        console.log(`      - ${symbol}: ${amount}`);
        totalAmounts[symbol] = (totalAmounts[symbol] || 0) + parseFloat(amount);
      });
    }
    if (result.ethRecovered !== "0") {
      console.log(`   ETH Recovered: ${result.ethRecovered}`);
    }
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
    }
    console.log();

    if (result.success) totalSuccess++;
    totalTokensTransferred += result.tokensTransferred;
    totalETH += parseFloat(result.ethRecovered);
  });

  console.log(`\n📈 Totals:`);
  console.log(`   Successful: ${totalSuccess}/${results.length}`);
  console.log(`   Tokens Transferred: ${totalTokensTransferred}`);
  if (Object.keys(totalAmounts).length > 0) {
    console.log(`   By Token:`);
    Object.entries(totalAmounts).forEach(([symbol, amount]) => {
      console.log(`      - ${symbol}: ${amount}`);
    });
  }
  console.log(`   ETH Recovered: ${totalETH.toFixed(8)}`);
  console.log(`\n📬 All tokens sent to: ${receiverWallet}\n`);
}

main().catch((error) => {
  console.error(`\n❌ Fatal error:`, error);
  process.exit(1);
});
