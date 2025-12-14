/**
 * Recover all tokens from test wallets used during development
 * This script will:
 * 1. Scan each wallet for all tokens (SEND, USDC, ETH, etc.)
 * 2. Derive private key from master mnemonic (if possible)
 * 3. Transfer all tokens directly to receiver wallet (no swapping)
 * 4. Transfer ETH to master wallet
 */

// Load .env.local file FIRST, before any imports that use process.env
import { readFileSync } from "fs";
import { join } from "path";

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
} catch (error) {
  console.error("⚠️  Could not read .env.local file. Make sure it exists in the project root.");
}

// Now import modules that use process.env
import { createWalletClient, createPublicClient, http, formatUnits, parseEther, formatEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { BASE_RPC_URL } from "../lib/constants";
import { scanWalletForAllTokens } from "../lib/wallet-scanner";
import { generateUserOfframpWallet, generateOfframpWallet, getReceiverWalletAddress, getMasterWallet } from "../lib/offramp-wallet";
import { supabaseAdmin } from "../lib/supabase";

// Test wallets to recover from
const TEST_WALLETS = [
  "0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2",
  "0xed77e10dd5158ED24c8857E1e7894FBe30D8f88c",
  "0xCadCda9Ae9f84B865c18dF5af43E60CaE0b31A52",
];

// Optional: Add wallets with their private keys if they can't be derived
const WALLETS_WITH_PRIVATE_KEYS: Record<string, string> = {
  // Format: "wallet_address": "private_key"
  // Example: "0x...": "0x..."
};

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
  totalAmounts: Record<string, string>; // token symbol -> amount transferred
  ethRecovered: string;
  errors: string[];
  txHashes: string[];
}

async function findWalletPrivateKey(walletAddress: string): Promise<{ privateKey: string; source: string } | null> {
  console.log(`\n🔑 Attempting to derive private key for ${walletAddress}...`);

  // 1. Check if private key is provided manually
  if (WALLETS_WITH_PRIVATE_KEYS[walletAddress.toLowerCase()]) {
    const privateKey = WALLETS_WITH_PRIVATE_KEYS[walletAddress.toLowerCase()];
    console.log(`   ✅ Found private key in manual list`);
    return { privateKey, source: "manual" };
  }

  // 2. Try to find transaction in database and derive from it
  const { data: transactions } = await supabaseAdmin
    .from("offramp_transactions")
    .select("*")
    .eq("unique_wallet_address", walletAddress.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(10);

  if (transactions && transactions.length > 0) {
    console.log(`   📋 Found ${transactions.length} transaction(s) in database`);

    for (const tx of transactions) {
      // Try old transaction-based method
      try {
        const oldWallet = generateOfframpWallet(tx.transaction_id);
        if (oldWallet.address.toLowerCase() === walletAddress.toLowerCase()) {
          console.log(`   ✅ Derived using old transaction-based method (tx: ${tx.transaction_id})`);
          return { privateKey: oldWallet.privateKey, source: "old_transaction_based" };
        }
      } catch (error) {
        // Continue to next method
      }

      // Try new user-based method
      try {
        const userIdentifier = tx.user_id || tx.user_email || `guest_${tx.user_account_number}`;
        const newWallet = generateUserOfframpWallet(userIdentifier);
        if (newWallet.address.toLowerCase() === walletAddress.toLowerCase()) {
          console.log(`   ✅ Derived using new user-based method (identifier: ${userIdentifier})`);
          return { privateKey: newWallet.privateKey, source: "new_user_based" };
        }
      } catch (error) {
        // Continue to next transaction
      }
    }
  }

  console.log(`   ❌ Could not derive private key from master mnemonic`);
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
    console.log(`🔄 Processing Wallet: ${walletAddress}`);
    console.log(`${"=".repeat(60)}`);

    // 1. Scan for tokens
    console.log(`\n1️⃣ Scanning wallet for tokens...`);
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
        console.log(`   ✅ Wallet is already empty (no tokens, no ETH)`);
        result.success = true;
        return result;
      } else {
        console.log(`   ⚠️  No tokens found, but wallet has ${formatEther(ethBalance)} ETH`);
        // Still try to recover ETH
      }
    } else {
      console.log(`   ✅ Found ${tokens.length} token(s):`);
      tokens.forEach((token, i) => {
        console.log(`      ${i + 1}. ${token.symbol}: ${token.amount}`);
      });
    }

    // 2. Find private key
    console.log(`\n2️⃣ Finding private key...`);
    const keyResult = await findWalletPrivateKey(walletAddress);

    if (!keyResult) {
      result.errors.push("Could not derive private key. Add it to WALLETS_WITH_PRIVATE_KEYS in the script.");
      console.log(`   ❌ Cannot proceed without private key`);
      return result;
    }

    result.privateKeyFound = true;
    console.log(`   ✅ Private key found (source: ${keyResult.source})`);

    // 3. Create wallet and public clients
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

    // 4. Receiver wallet is passed as parameter
    console.log(`\n3️⃣ Receiver wallet: ${receiverWallet}`);

    // 5. Transfer all ERC20 tokens to receiver wallet
    const erc20Tokens = tokens.filter((t) => t.address !== null && t.symbol !== "ETH");
    
    if (erc20Tokens.length > 0) {
      console.log(`\n4️⃣ Transferring ${erc20Tokens.length} ERC20 token(s) to receiver wallet...`);

      // Check ETH balance for gas
      const ethBalance = await publicClient.getBalance({
        address: walletAddress as `0x${string}`,
      });

      const minGasRequired = parseEther("0.0001");
      if (ethBalance < minGasRequired) {
        console.log(`   ⚠️  Insufficient ETH for gas (${formatEther(ethBalance)} ETH). Funding from master wallet...`);
        
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

        if (availableToSend > 0) {
          const maxToSend = parseEther("0.0002");
          const ethAmount = availableToSend > maxToSend ? maxToSend : availableToSend;

          console.log(`   💰 Sending ${formatEther(ethAmount)} ETH from master wallet...`);
          const fundTxHash = await masterWalletClient.sendTransaction({
            to: walletAddress as `0x${string}`,
            value: ethAmount,
          });

          await publicClient.waitForTransactionReceipt({ hash: fundTxHash });
          console.log(`   ✅ Gas funded: ${fundTxHash}`);
        } else {
          result.errors.push("Master wallet has insufficient ETH to fund gas");
          console.log(`   ❌ Cannot fund gas. Master wallet balance: ${formatEther(masterBalance)} ETH`);
        }
      }

      // Transfer each ERC20 token
      for (const token of erc20Tokens) {
        try {
          if (!token.address) continue;

          const balance = BigInt(token.amountRaw);
          console.log(`\n   📤 Transferring ${token.symbol} (${token.amount})...`);

          const txHash = await walletClient.writeContract({
            address: token.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [receiverWallet as `0x${string}`, balance],
          });

          console.log(`      Transaction sent: ${txHash}`);
          
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          
          if (receipt.status === "success") {
            console.log(`      ✅ ${token.symbol} transferred successfully`);
            result.tokensTransferred++;
            result.totalAmounts[token.symbol] = token.amount;
            result.txHashes.push(txHash);
          } else {
            result.errors.push(`${token.symbol} transfer failed: ${txHash}`);
            console.log(`      ❌ ${token.symbol} transfer failed`);
          }
        } catch (error: any) {
          const errorMsg = `Error transferring ${token.symbol}: ${error.message}`;
          result.errors.push(errorMsg);
          console.error(`      ❌ ${errorMsg}`);
        }
      }
    } else {
      console.log(`\n4️⃣ No ERC20 tokens to transfer`);
    }

    // 6. Transfer ETH to master wallet (leave a tiny amount for safety)
    console.log(`\n5️⃣ Recovering ETH to master wallet...`);
    try {
      const remainingETH = await publicClient.getBalance({
        address: walletAddress as `0x${string}`,
      });

      const minETHToRecover = parseEther("0.0001");
      if (remainingETH > minETHToRecover) {
        const masterWallet = getMasterWallet();
        const ethToRecover = remainingETH - parseEther("0.00001"); // Leave tiny amount for safety
        
        console.log(`   💰 Recovering ${formatEther(ethToRecover)} ETH to master wallet...`);
        
        const ethTxHash = await walletClient.sendTransaction({
          to: masterWallet.address as `0x${string}`,
          value: ethToRecover,
        });

        await publicClient.waitForTransactionReceipt({ hash: ethTxHash });
        result.ethRecovered = formatEther(ethToRecover);
        result.txHashes.push(ethTxHash);
        console.log(`   ✅ ETH recovered: ${ethTxHash}`);
      } else {
        console.log(`   ⚠️  ETH balance too low to recover (${formatEther(remainingETH)} ETH)`);
      }
    } catch (error: any) {
      result.errors.push(`Error recovering ETH: ${error.message}`);
      console.error(`   ❌ Error recovering ETH: ${error.message}`);
    }

    result.success = result.errors.length === 0;
    
    if (result.success) {
      console.log(`\n   ✅ Wallet recovery completed successfully!`);
    } else {
      console.log(`\n   ⚠️  Wallet recovery completed with errors:`);
      result.errors.forEach((error) => {
        console.log(`      - ${error}`);
      });
    }

    return result;
  } catch (error: any) {
    result.errors.push(error.message || "Unknown error");
    console.error(`   ❌ Error recovering wallet: ${error.message}`);
    return result;
  }
}

async function main() {
  console.log(`\n${"#".repeat(60)}`);
  console.log(`🚀 Test Wallet Recovery Script`);
  console.log(`📦 Direct Token Transfer (No Swapping)`);
  console.log(`${"#".repeat(60)}\n`);

  // Get receiver wallet from command line argument or environment
  const receiverWalletArg = process.argv[2];
  let receiverWallet: string;
  
  try {
    receiverWallet = receiverWalletArg || getReceiverWalletAddress();
  } catch (error) {
    if (!receiverWalletArg) {
      console.error(`\n❌ Error: OFFRAMP_RECEIVER_WALLET_ADDRESS not set in .env.local`);
      console.error(`   Please provide receiver wallet address as argument:`);
      console.error(`   Usage: npx tsx scripts/recover-all-test-wallets.ts <receiver_wallet_address>\n`);
      process.exit(1);
    }
    receiverWallet = receiverWalletArg;
  }

  // Validate receiver wallet address
  if (!receiverWallet.startsWith("0x") || receiverWallet.length !== 42) {
    console.error(`\n❌ Error: Invalid receiver wallet address: ${receiverWallet}`);
    console.error(`   Must be a valid Ethereum address (0x followed by 40 hex characters)\n`);
    process.exit(1);
  }

  console.log(`📋 Wallets to recover: ${TEST_WALLETS.length}`);
  TEST_WALLETS.forEach((wallet, i) => {
    console.log(`   ${i + 1}. ${wallet}`);
  });

  console.log(`\n📬 All tokens will be sent to: ${receiverWallet}`);

  const results: RecoveryResult[] = [];

  for (const wallet of TEST_WALLETS) {
    const result = await recoverWallet(wallet, receiverWallet);
    results.push(result);

    // Wait a bit between wallets to avoid rate limiting
    if (wallet !== TEST_WALLETS[TEST_WALLETS.length - 1]) {
      console.log(`\n⏳ Waiting 3 seconds before next wallet...`);
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
    console.log(`${status} Wallet ${i + 1}: ${result.walletAddress}`);
    console.log(`   Private Key: ${result.privateKeyFound ? "✅ Found" : "❌ Not Found"}`);
    console.log(`   Tokens Found: ${result.tokensFound}`);
    console.log(`   Tokens Transferred: ${result.tokensTransferred}`);
    if (Object.keys(result.totalAmounts).length > 0) {
      console.log(`   Amounts Transferred:`);
      Object.entries(result.totalAmounts).forEach(([symbol, amount]) => {
        console.log(`      - ${symbol}: ${amount}`);
        totalAmounts[symbol] = (totalAmounts[symbol] || 0) + parseFloat(amount);
      });
    }
    console.log(`   ETH Recovered: ${result.ethRecovered}`);
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.join(", ")}`);
    }
    if (result.txHashes.length > 0) {
      console.log(`   TX Hashes: ${result.txHashes.join(", ")}`);
    }
    console.log();

    if (result.success) totalSuccess++;
    totalTokensTransferred += result.tokensTransferred;
    totalETH += parseFloat(result.ethRecovered);
  });

  console.log(`\n📈 Totals:`);
  console.log(`   Successful: ${totalSuccess}/${results.length}`);
  console.log(`   Total Tokens Transferred: ${totalTokensTransferred}`);
  if (Object.keys(totalAmounts).length > 0) {
    console.log(`   Total Amounts by Token:`);
    Object.entries(totalAmounts).forEach(([symbol, amount]) => {
      console.log(`      - ${symbol}: ${amount}`);
    });
  }
  console.log(`   Total ETH Recovered: ${totalETH.toFixed(8)}`);
  console.log(`\n📬 All tokens sent to: ${receiverWallet}`);
  console.log();
}

main().catch((error) => {
  console.error(`\n❌ Fatal error:`, error);
  process.exit(1);
});

