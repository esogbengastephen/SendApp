/**
 * Try BOTH transaction-based AND user-based derivation
 */
import { ethers } from "ethers";
import { createWalletClient, createPublicClient, http, parseEther, formatUnits } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createClient } from "@supabase/supabase-js";

const MASTER_MNEMONIC = "spray poem meat special horror cousin parrot number student file target area";
const MASTER_PRIVATE_KEY = "0x4ad77fb017847c51258c59f4c348b179a63d6d225d7857987b57c906c5f10c40";
const BASE_RPC_URL = "https://mainnet.base.org";
const RECEIVER = "0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0";
const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";

const SUPABASE_URL = "https://ksdzzqdafodlstfkqzuv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzZHp6cWRhZm9kbHN0ZmtxenV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzY3NjYxNSwiZXhwIjoyMDc5MjUyNjE1fQ.bYpA34vIz5hjzHDNTBEZd4EpRpOk2wOcb228EkaljWc";

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

function deriveFromTransaction(txId: string) {
  const indexHash = ethers.keccak256(ethers.toUtf8Bytes(txId));
  const indexNumber = BigInt(indexHash) % BigInt(2147483647);
  const mnemonic = ethers.Mnemonic.fromPhrase(MASTER_MNEMONIC);
  const seed = mnemonic.computeSeed();
  const rootNode = ethers.HDNodeWallet.fromSeed(seed);
  const wallet = rootNode.derivePath(`m/44'/60'/0'/0/${indexNumber}`);
  return { address: wallet.address, privateKey: wallet.privateKey };
}

function deriveFromUser(userIdentifier: string) {
  const indexHash = ethers.keccak256(ethers.toUtf8Bytes(`user_${userIdentifier.toLowerCase()}`));
  const indexNumber = BigInt(indexHash) % BigInt(2147483647);
  const mnemonic = ethers.Mnemonic.fromPhrase(MASTER_MNEMONIC);
  const seed = mnemonic.computeSeed();
  const rootNode = ethers.HDNodeWallet.fromSeed(seed);
  const wallet = rootNode.derivePath(`m/44'/60'/0'/0/${indexNumber}`);
  return { address: wallet.address, privateKey: wallet.privateKey };
}

async function main() {
  console.log(`\n${"#".repeat(60)}`);
  console.log(`🚀 Token Recovery - Try Both Methods`);
  console.log(`${"#".repeat(60)}\n`);
  
  const { data: transactions } = await supabase
    .from('offramp_transactions')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (!transactions) {
    console.log("No transactions");
    return;
  }
  
  const uniqueWallets = [...new Set(transactions.map(t => t.unique_wallet_address))];
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });
  
  let recovered = 0;
  
  for (const walletAddress of uniqueWallets) {
    console.log(`${"=".repeat(60)}`);
    console.log(`🔄 ${walletAddress}`);
    
    try {
      const sendBalance = await publicClient.readContract({
        address: SEND_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [walletAddress as `0x${string}`],
      }) as bigint;
      
      console.log(`   SEND: ${formatUnits(sendBalance, 18)}`);
      
      if (sendBalance === 0n) {
        console.log(`   ✅ Empty\n`);
        continue;
      }
      
      // Get all transactions for this wallet
      const walletTxs = transactions.filter(t => t.unique_wallet_address === walletAddress);
      let matchedKey: string | null = null;
      
      // Try ALL transactions with BOTH methods
      for (const tx of walletTxs) {
        // Try tx-based
        try {
          const derived = deriveFromTransaction(tx.transaction_id);
          if (derived.address.toLowerCase() === walletAddress.toLowerCase()) {
            console.log(`   ✅ TX-BASED MATCH (${tx.transaction_id})`);
            matchedKey = derived.privateKey;
            break;
          }
        } catch (e) {}
        
        // Try user-based
        try {
          const userIdentifier = tx.user_id || tx.user_email || `guest_${tx.user_account_number}`;
          const derived = deriveFromUser(userIdentifier);
          if (derived.address.toLowerCase() === walletAddress.toLowerCase()) {
            console.log(`   ✅ USER-BASED MATCH (${userIdentifier})`);
            matchedKey = derived.privateKey;
            break;
          }
        } catch (e) {}
      }
      
      if (!matchedKey) {
        console.log(`   ❌ No match found\n`);
        continue;
      }
      
      // Transfer
      const account = privateKeyToAccount(matchedKey as `0x${string}`);
      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http(BASE_RPC_URL),
      });
      
      const ethBalance = await publicClient.getBalance({ address: walletAddress as `0x${string}` });
      const minGas = parseEther("0.0001");
      
      if (ethBalance < minGas) {
        console.log(`   💰 Funding gas...`);
        const masterAccount = privateKeyToAccount(MASTER_PRIVATE_KEY as `0x${string}`);
        const masterClient = createWalletClient({
          account: masterAccount,
          chain: base,
          transport: http(BASE_RPC_URL),
        });
        
        const fundTx = await masterClient.sendTransaction({
          to: walletAddress as `0x${string}`,
          value: parseEther("0.0003"),
        });
        await publicClient.waitForTransactionReceipt({ hash: fundTx });
        console.log(`      ✅ Funded`);
        await new Promise(r => setTimeout(r, 3000));
      }
      
      const txHash = await walletClient.writeContract({
        address: SEND_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [RECEIVER as `0x${string}`, sendBalance],
      });
      
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(`   ✅ Transferred ${formatUnits(sendBalance, 18)} SEND`);
      console.log(`   TX: ${txHash}\n`);
      
      recovered++;
      await new Promise(r => setTimeout(r, 5000));
      
    } catch (error: any) {
      console.error(`   ❌ ${error.message?.substring(0, 100)}\n`);
    }
  }
  
  console.log(`\n${"#".repeat(60)}`);
  console.log(`📊 Successfully recovered ${recovered} wallets!`);
  console.log(`${"#".repeat(60)}\n`);
}

main().catch(console.error);
