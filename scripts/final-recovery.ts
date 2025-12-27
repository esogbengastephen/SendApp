/**
 * Final recovery script with correct RPC and database-based key derivation
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
} catch (error) {
  console.error("⚠️  Could not read .env.local");
}

import { createWalletClient, createPublicClient, http, parseEther, formatEther, formatUnits } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { generateUserOfframpWallet, generateOfframpWallet, getMasterWallet } from "../lib/offramp-wallet";
import { supabaseAdmin } from "../lib/supabase";

const BASE_RPC_URL = "https://mainnet.base.org";
const RECEIVER_WALLET = "0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0";
const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const USDC_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

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
] as const;

async function findPrivateKey(walletAddress: string): Promise<string | null> {
  const { data: transactions } = await supabaseAdmin
    .from("offramp_transactions")
    .select("*")
    .eq("unique_wallet_address", walletAddress.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(10);

  if (transactions && transactions.length > 0) {
    for (const tx of transactions) {
      // Try old transaction-based method
      try {
        const oldWallet = generateOfframpWallet(tx.transaction_id);
        if (oldWallet.address.toLowerCase() === walletAddress.toLowerCase()) {
          return oldWallet.privateKey;
        }
      } catch (error) {}

      // Try new user-based method
      try {
        const userIdentifier = tx.user_id || tx.user_email || `guest_${tx.user_account_number}`;
        const newWallet = generateUserOfframpWallet(userIdentifier);
        if (newWallet.address.toLowerCase() === walletAddress.toLowerCase()) {
          return newWallet.privateKey;
        }
      } catch (error) {}
    }
  }
  return null;
}

async function recoverWallet(wallet: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔄 ${wallet}`);
  console.log(`${"=".repeat(60)}`);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });
  
  let transferred = 0;
  
  try {
    // Check balances
    console.log(`  📡 Checking balances...`);
    
    const ethBalance = await publicClient.getBalance({ address: wallet as `0x${string}` });
    const sendBalance = await publicClient.readContract({
      address: SEND_TOKEN as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [wallet as `0x${string}`],
    }) as bigint;
    const usdcBalance = await publicClient.readContract({
      address: USDC_TOKEN as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [wallet as `0x${string}`],
    }) as bigint;
    
    if (ethBalance === 0n && sendBalance === 0n && usdcBalance === 0n) {
      console.log(`  ✅ Empty`);
      return { success: true, transferred: 0 };
    }
    
    console.log(`  💎 ETH: ${formatEther(ethBalance)}`);
    if (sendBalance > 0n) console.log(`  🎯 SEND: ${formatUnits(sendBalance, 18)}`);
    if (usdcBalance > 0n) console.log(`  💵 USDC: ${formatUnits(usdcBalance, 6)}`);
    
    // Find private key
    console.log(`\n  🔑 Finding private key...`);
    const privateKey = await findPrivateKey(wallet);
    
    if (!privateKey) {
      console.log(`     ❌ Could not derive key`);
      return { success: false, transferred: 0 };
    }
    
    console.log(`     ✅ Key found`);
    
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(BASE_RPC_URL),
    });
    
    // Fund gas if needed
    const minGas = parseEther("0.0001");
    if (ethBalance < minGas && (sendBalance > 0n || usdcBalance > 0n)) {
      console.log(`\n  💰 Funding gas...`);
      const masterWallet = getMasterWallet();
      const masterAccount = privateKeyToAccount(masterWallet.privateKey as `0x${string}`);
      const masterClient = createWalletClient({
        account: masterAccount,
        chain: base,
        transport: http(BASE_RPC_URL),
      });
      
      const fundTx = await masterClient.sendTransaction({
        to: wallet as `0x${string}`,
        value: parseEther("0.0002"),
      });
      await publicClient.waitForTransactionReceipt({ hash: fundTx });
      console.log(`     ✅ Funded`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Transfer SEND
    if (sendBalance > 0n) {
      console.log(`\n  📤 Transferring SEND...`);
      try {
        const txHash = await walletClient.writeContract({
          address: SEND_TOKEN as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [RECEIVER_WALLET as `0x${string}`, sendBalance],
        });
        
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log(`     ✅ Transferred ${formatUnits(sendBalance, 18)} SEND`);
        console.log(`     TX: ${txHash}`);
        transferred++;
      } catch (error: any) {
        console.error(`     ❌ Error: ${error.message?.substring(0, 100)}`);
      }
    }
    
    // Transfer USDC
    if (usdcBalance > 0n) {
      console.log(`\n  📤 Transferring USDC...`);
      try {
        const txHash = await walletClient.writeContract({
          address: USDC_TOKEN as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [RECEIVER_WALLET as `0x${string}`, usdcBalance],
        });
        
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log(`     ✅ Transferred ${formatUnits(usdcBalance, 6)} USDC`);
        console.log(`     TX: ${txHash}`);
        transferred++;
      } catch (error: any) {
        console.error(`     ❌ Error: ${error.message?.substring(0, 100)}`);
      }
    }
    
    // Recover ETH to master
    const finalEth = await publicClient.getBalance({ address: wallet as `0x${string}` });
    if (finalEth > parseEther("0.0001")) {
      console.log(`\n  💸 Recovering ETH to master...`);
      try {
        const masterWallet = getMasterWallet();
        const ethToRecover = finalEth - parseEther("0.00001");
        
        const ethTx = await walletClient.sendTransaction({
          to: masterWallet.address as `0x${string}`,
          value: ethToRecover,
        });
        await publicClient.waitForTransactionReceipt({ hash: ethTx });
        console.log(`     ✅ Recovered ${formatEther(ethToRecover)} ETH`);
      } catch (error: any) {
        console.error(`     ❌ Error: ${error.message?.substring(0, 100)}`);
      }
    }
    
    console.log(`\n  ✅ Complete`);
    return { success: true, transferred };
    
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
    return { success: false, transferred: 0 };
  }
}

async function main() {
  console.log(`\n${"#".repeat(60)}`);
  console.log(`🚀 Offramp Token Recovery`);
  console.log(`${"#".repeat(60)}`);
  console.log(`\n📬 Receiver: ${RECEIVER_WALLET}\n`);
  
  // Get all wallets from database
  const { data: transactions } = await supabaseAdmin
    .from('offramp_transactions')
    .select('unique_wallet_address')
    .order('created_at', { ascending: false });
  
  const wallets = [...new Set(transactions?.map(t => t.unique_wallet_address) || [])];
  console.log(`📋 Found ${wallets.length} wallets\n`);
  
  let totalTransferred = 0;
  
  for (const wallet of wallets) {
    const result = await recoverWallet(wallet);
    totalTransferred += result.transferred;
    
    if (wallet !== wallets[wallets.length - 1]) {
      console.log(`\n⏳ Waiting 5 seconds...\n`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log(`\n${"#".repeat(60)}`);
  console.log(`📊 Summary: ${totalTransferred} token types recovered`);
  console.log(`${"#".repeat(60)}\n`);
}

main().catch(console.error);
