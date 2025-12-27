/**
 * Direct recovery with credentials as arguments (no env dependencies)
 */
import { createWalletClient, createPublicClient, http, parseEther, formatEther, formatUnits, Wallet } from "viem";
import { base } from "viem/chains";
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";
import { privateKeyToAccount } from "viem/accounts";
import { createClient } from "@supabase/supabase-js";

const BASE_RPC_URL = "https://mainnet.base.org";
const RECEIVER_WALLET = "0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0";
const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const USDC_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Get from command line
const SUPABASE_URL = process.argv[2];
const SUPABASE_KEY = process.argv[3];
const MASTER_MNEMONIC = process.argv[4];
const MASTER_PRIVATE_KEY = process.argv[5];

if (!SUPABASE_URL || !SUPABASE_KEY || !MASTER_MNEMONIC || !MASTER_PRIVATE_KEY) {
  console.error('\n❌ Usage: npx tsx scripts/direct-recovery.ts <supabase_url> <supabase_key> "mnemonic" "0xMasterKey"\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

// Import ethers for proper key derivation
import { ethers } from "ethers";

function deriveWalletFromTransaction(txId: string): { address: string; privateKey: string } {
  // Use transaction ID hash as derivation index (exact same as offramp-wallet.ts)
  const indexHash = ethers.keccak256(ethers.toUtf8Bytes(txId));
  const indexNumber = BigInt(indexHash) % BigInt(2147483647);
  
  const derivationPath = `m/44'/60'/0'/0/${indexNumber}`;
  
  // Create root HD node from mnemonic seed
  const mnemonic = ethers.Mnemonic.fromPhrase(MASTER_MNEMONIC);
  const seed = mnemonic.computeSeed();
  const rootNode = ethers.HDNodeWallet.fromSeed(seed);
  
  // Derive the specific wallet for this transaction
  const wallet = rootNode.derivePath(derivationPath);
  
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

function deriveWalletFromUser(userIdentifier: string): { address: string; privateKey: string } {
  // Use user identifier hash as derivation index (exact same as offramp-wallet.ts)
  const indexHash = ethers.keccak256(ethers.toUtf8Bytes(`user_${userIdentifier.toLowerCase()}`));
  const indexNumber = BigInt(indexHash) % BigInt(2147483647);
  
  const derivationPath = `m/44'/60'/0'/0/${indexNumber}`;
  
  // Create root HD node from mnemonic seed
  const mnemonic = ethers.Mnemonic.fromPhrase(MASTER_MNEMONIC);
  const seed = mnemonic.computeSeed();
  const rootNode = ethers.HDNodeWallet.fromSeed(seed);
  
  // Derive the specific wallet for this user
  const wallet = rootNode.derivePath(derivationPath);
  
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

async function findPrivateKey(walletAddress: string): Promise<string | null> {
  const { data: transactions } = await supabase
    .from("offramp_transactions")
    .select("*")
    .eq("unique_wallet_address", walletAddress.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(10);

  if (transactions && transactions.length > 0) {
    for (const tx of transactions) {
      // Try transaction-based
      try {
        const wallet = deriveWalletFromTransaction(tx.transaction_id);
        if (wallet.address.toLowerCase() === walletAddress.toLowerCase()) {
          return wallet.privateKey;
        }
      } catch (error) {}

      // Try user-based
      try {
        const userIdentifier = tx.user_id || tx.user_email || `guest_${tx.user_account_number}`;
        const wallet = deriveWalletFromUser(userIdentifier);
        if (wallet.address.toLowerCase() === walletAddress.toLowerCase()) {
          return wallet.privateKey;
        }
      } catch (error) {}
    }
  }
  return null;
}

async function recoverWallet(wallet: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔄 ${wallet}`);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });
  
  let transferred = 0;
  
  try {
    // Check balances
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
    
    // Find key
    const privateKey = await findPrivateKey(wallet);
    if (!privateKey) {
      console.log(`  ❌ Could not derive key`);
      return { success: false, transferred: 0 };
    }
    
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
      const masterAccount = privateKeyToAccount(MASTER_PRIVATE_KEY as `0x${string}`);
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
      await new Promise(r => setTimeout(r, 3000));
    }
    
    // Transfer SEND
    if (sendBalance > 0n) {
      console.log(`\n  📤 Transferring ${formatUnits(sendBalance, 18)} SEND...`);
      const txHash = await walletClient.writeContract({
        address: SEND_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [RECEIVER_WALLET as `0x${string}`, sendBalance],
      });
      
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(`     ✅ TX: ${txHash}`);
      transferred++;
    }
    
    // Transfer USDC
    if (usdcBalance > 0n) {
      console.log(`\n  📤 Transferring ${formatUnits(usdcBalance, 6)} USDC...`);
      const txHash = await walletClient.writeContract({
        address: USDC_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [RECEIVER_WALLET as `0x${string}`, usdcBalance],
      });
      
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(`     ✅ TX: ${txHash}`);
      transferred++;
    }
    
    // Recover ETH
    const finalEth = await publicClient.getBalance({ address: wallet as `0x${string}` });
    if (finalEth > parseEther("0.0001")) {
      console.log(`\n  💸 Recovering ${formatEther(finalEth - parseEther("0.00001"))} ETH...`);
      const masterAccount = privateKeyToAccount(MASTER_PRIVATE_KEY as `0x${string}`);
      const ethTx = await walletClient.sendTransaction({
        to: masterAccount.address,
        value: finalEth - parseEther("0.00001"),
      });
      await publicClient.waitForTransactionReceipt({ hash: ethTx });
      console.log(`     ✅ Done`);
    }
    
    console.log(`\n  ✅ Complete (${transferred} tokens)`);
    return { success: true, transferred };
    
  } catch (error: any) {
    console.error(`  ❌ ${error.message?.substring(0, 100)}`);
    return { success: false, transferred: 0 };
  }
}

async function main() {
  console.log(`\n${"#".repeat(60)}`);
  console.log(`🚀 Offramp Token Recovery`);
  console.log(`${"#".repeat(60)}\n`);
  
  const { data: transactions } = await supabase
    .from('offramp_transactions')
    .select('unique_wallet_address')
    .order('created_at', { ascending: false });
  
  const wallets = [...new Set(transactions?.map(t => t.unique_wallet_address) || [])];
  console.log(`📋 ${wallets.length} wallets found\n`);
  
  let totalTransferred = 0;
  
  for (const wallet of wallets) {
    const result = await recoverWallet(wallet);
    totalTransferred += result.transferred;
    
    if (wallet !== wallets[wallets.length - 1]) {
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  
  console.log(`\n${"#".repeat(60)}`);
  console.log(`📊 Total: ${totalTransferred} token transfers completed`);
  console.log(`${"#".repeat(60)}\n`);
}

main().catch(console.error);
