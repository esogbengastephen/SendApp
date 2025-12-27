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

const WALLETS = [
  "0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2",
  "0xCadCda9Ae9f84B865c18dF5af43E60CaE0b31A52",
  "0x4Ff937F3Cd784F4024A311B195f5007935537DC7",
  "0xFa5d32A62feFD8d6609464EdeFbb68Ecd7a26cC4",
  "0x6a2276395B8C617463f3C1574Cb57E82EcbF0522",
  "0x20717a8732d3341201fa33a06bbe5ed91dbfdeb2",
  "0xed77e10dd5158ED24c8857E1e7894FBe30D8f88c",
];

function deriveKey(txData: any, walletAddress: string): string | null {
  // Try tx-based
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
  
  // Try user-based
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
  
  let totalRecovered = 0n;
  
  for (const walletAddress of WALLETS) {
    console.log(`${"=".repeat(60)}`);
    console.log(`${walletAddress}`);
    
    try {
      const ethBalance = await publicClient.getBalance({ address: walletAddress as `0x${string}` });
      console.log(`  ETH: ${formatEther(ethBalance)}`);
      
      if (ethBalance === 0n) {
        console.log(`  ✅ Empty\n`);
        continue;
      }
      
      // Get tx data
      const { data: txs } = await supabase
        .from('offramp_transactions')
        .select('*')
        .eq('unique_wallet_address', walletAddress.toLowerCase());
      
      if (!txs || txs.length === 0) {
        console.log(`  ⚠️  No DB record\n`);
        continue;
      }
      
      let privateKey: string | null = null;
      for (const tx of txs) {
        privateKey = deriveKey(tx, walletAddress);
        if (privateKey) break;
      }
      
      if (!privateKey) {
        console.log(`  ❌ No key\n`);
        continue;
      }
      
      // Calculate max we can send
      const gasPrice = await publicClient.getGasPrice();
      const gasLimit = BigInt(21000);
      const maxGasCost = gasPrice * gasLimit * BigInt(12) / BigInt(10); // 120% buffer
      
      if (ethBalance <= maxGasCost) {
        console.log(`  ⚠️  Too small (gas > balance)\n`);
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
      console.log(`  ✅ ${txHash}\n`);
      
      totalRecovered += ethToSend;
      await new Promise(r => setTimeout(r, 3000));
      
    } catch (error: any) {
      console.error(`  ❌ ${error.message?.substring(0, 80)}\n`);
    }
  }
  
  console.log(`\n💎 Total: ${formatEther(totalRecovered)} ETH → ${RECEIVER}\n`);
}

main().catch(console.error);
