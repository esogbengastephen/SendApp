import { ethers } from "ethers";
import { createWalletClient, createPublicClient, http, formatEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createClient } from "@supabase/supabase-js";

const MASTER_MNEMONIC = "spray poem meat special horror cousin parrot number student file target area";
const BASE_RPC_URL = "https://mainnet.base.org";
const RECEIVER = "0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0";
const SUPABASE_URL = "https://ksdzzqdafodlstfkqzuv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzZHp6cWRhZm9kbHN0ZmtxenV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzY3NjYxNSwiZXhwIjoyMDc5MjUyNjE1fQ.bYpA34vIz5hjzHDNTBEZd4EpRpOk2wOcb228EkaljWc";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function deriveKey(txData: any, walletAddress: string): string | null {
  try {
    const indexHash = ethers.keccak256(ethers.toUtf8Bytes(txData.transaction_id));
    const indexNumber = BigInt(indexHash) % BigInt(2147483647);
    const mnemonic = ethers.Mnemonic.fromPhrase(MASTER_MNEMONIC);
    const seed = mnemonic.computeSeed();
    const rootNode = ethers.HDNodeWallet.fromSeed(seed);
    const wallet = rootNode.derivePath(`m/44'/60'/0'/0/${indexNumber}`);
    if (wallet.address.toLowerCase() === walletAddress.toLowerCase()) {
      return wallet.privateKey;
    }
  } catch (e) {}
  
  try {
    const userIdentifier = txData.user_id || txData.user_email || `guest_${txData.user_account_number}`;
    const indexHash = ethers.keccak256(ethers.toUtf8Bytes(`user_${userIdentifier.toLowerCase()}`));
    const indexNumber = BigInt(indexHash) % BigInt(2147483647);
    const mnemonic = ethers.Mnemonic.fromPhrase(MASTER_MNEMONIC);
    const seed = mnemonic.computeSeed();
    const rootNode = ethers.HDNodeWallet.fromSeed(seed);
    const wallet = rootNode.derivePath(`m/44'/60'/0'/0/${indexNumber}`);
    if (wallet.address.toLowerCase() === walletAddress.toLowerCase()) {
      return wallet.privateKey;
    }
  } catch (e) {}
  
  return null;
}

async function main() {
  console.log(`\n💎 Recovering ALL ETH\n`);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });
  
  // Get all transactions
  const { data: allTxs } = await supabase
    .from('offramp_transactions')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (!allTxs) {
    console.log("No transactions");
    return;
  }
  
  const uniqueWallets = [...new Set(allTxs.map(t => t.unique_wallet_address))];
  let totalRecovered = 0n;
  
  for (const walletAddress of uniqueWallets) {
    console.log(`${"=".repeat(60)}`);
    console.log(`${walletAddress}`);
    
    try {
      const ethBalance = await publicClient.getBalance({ address: walletAddress as `0x${string}` });
      console.log(`  ${formatEther(ethBalance)} ETH`);
      
      if (ethBalance === 0n) {
        console.log(`  ✅ Empty\n`);
        continue;
      }
      
      const txs = allTxs.filter(t => t.unique_wallet_address === walletAddress);
      let privateKey: string | null = null;
      
      for (const tx of txs) {
        privateKey = deriveKey(tx, walletAddress);
        if (privateKey) break;
      }
      
      if (!privateKey) {
        console.log(`  ❌ No key\n`);
        continue;
      }
      
      const gasPrice = await publicClient.getGasPrice();
      const gasLimit = BigInt(21000);
      const maxGasCost = gasPrice * gasLimit * BigInt(13) / BigInt(10);
      
      if (ethBalance <= maxGasCost) {
        console.log(`  ⚠️  Too small\n`);
        continue;
      }
      
      const ethToSend = ethBalance - maxGasCost;
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http(BASE_RPC_URL),
      });
      
      console.log(`  📤 Sending ${formatEther(ethToSend)}...`);
      const txHash = await walletClient.sendTransaction({
        to: RECEIVER as `0x${string}`,
        value: ethToSend,
      });
      
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(`  ✅ Done\n`);
      
      totalRecovered += ethToSend;
      await new Promise(r => setTimeout(r, 3000));
      
    } catch (error: any) {
      console.error(`  ❌ ${error.message?.substring(0, 60)}\n`);
    }
  }
  
  console.log(`\n💎 Total: ${formatEther(totalRecovered)} ETH\n`);
}

main().catch(console.error);
