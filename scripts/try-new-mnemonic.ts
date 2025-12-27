/**
 * Try the new mnemonic provided by user
 */
import { ethers } from "ethers";
import { createWalletClient, createPublicClient, http, parseEther, formatEther, formatUnits } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createClient } from "@supabase/supabase-js";

// NEW MNEMONIC FROM USER
const MASTER_MNEMONIC = "spray poem meat special horror cousin parrot number student file target area";
const MASTER_PRIVATE_KEY = "0x4ad77fb017847c51258c59f4c348b179a63d6d225d7857987b57c906c5f10c40";
const BASE_RPC_URL = "https://mainnet.base.org";
const RECEIVER_WALLET = "0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0";
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

const WALLETS_WITH_TOKENS = [
  { address: "0x6905325f09Bd165C6F983519070979b9F4B232ec", send: "5" },
  { address: "0x20717a8732d3341201fa33a06bbe5ed91dbfdeb2", send: "100" },
  { address: "0xCadCda9Ae9f84B865c18dF5af43E60CaE0b31A52", send: "50" },
  { address: "0x4Ff937F3Cd784F4024A311B195f5007935537DC7", send: "10" },
  { address: "0xFa5d32A62feFD8d6609464EdeFbb68Ecd7a26cC4", send: "10" },
  { address: "0x6a2276395B8C617463f3C1574Cb57E82EcbF0522", send: "10" },
  { address: "0x6459AE03e607E9F1A62De6bC17b6977a9F922679", send: "10" },
];

function tryDeriveKey(walletAddress: string, txData: any): string | null {
  // Try tx-based
  try {
    const indexHash = ethers.keccak256(ethers.toUtf8Bytes(txData.transaction_id));
    const indexNumber = BigInt(indexHash) % BigInt(2147483647);
    const mnemonic = ethers.Mnemonic.fromPhrase(MASTER_MNEMONIC);
    const seed = mnemonic.computeSeed();
    const rootNode = ethers.HDNodeWallet.fromSeed(seed);
    const wallet = rootNode.derivePath(`m/44'/60'/0'/0/${indexNumber}`);
    
    if (wallet.address.toLowerCase() === walletAddress.toLowerCase()) {
      console.log(`      ✅ TX-BASED MATCH!`);
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
      console.log(`      ✅ USER-BASED MATCH!`);
      return wallet.privateKey;
    }
  } catch (e) {}
  
  return null;
}

async function recoverWallet(walletInfo: any) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔄 ${walletInfo.address}`);
  console.log(`   Expected: ${walletInfo.send} SEND`);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });
  
  try {
    // Check balance
    const sendBalance = await publicClient.readContract({
      address: SEND_TOKEN as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [walletInfo.address as `0x${string}`],
    }) as bigint;
    
    console.log(`   Actual: ${formatUnits(sendBalance, 18)} SEND`);
    
    if (sendBalance === 0n) {
      console.log(`   ✅ Already empty`);
      return { success: true };
    }
    
    // Get transaction data from DB
    const { data: transactions } = await supabase
      .from('offramp_transactions')
      .select('*')
      .eq('unique_wallet_address', walletInfo.address.toLowerCase());
    
    if (!transactions || transactions.length === 0) {
      console.log(`   ⚠️  No transaction in DB - trying direct methods...`);
      return { success: false };
    }
    
    console.log(`   📋 Found ${transactions.length} transaction(s)`);
    
    // Try to derive private key using any transaction
    let privateKey: string | null = null;
    for (const txData of transactions) {
      privateKey = tryDeriveKey(walletInfo.address, txData);
      if (privateKey) break;
    }
    
    if (!privateKey) {
      console.log(`   ❌ Could not derive private key`);
      return { success: false };
    }
    
    // Create wallet client
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(BASE_RPC_URL),
    });
    
    // Check if we need gas
    const ethBalance = await publicClient.getBalance({ address: walletInfo.address as `0x${string}` });
    const minGas = parseEther("0.0001");
    
    if (ethBalance < minGas) {
      console.log(`\n   💰 Funding gas...`);
      const masterAccount = privateKeyToAccount(MASTER_PRIVATE_KEY as `0x${string}`);
      const masterClient = createWalletClient({
        account: masterAccount,
        chain: base,
        transport: http(BASE_RPC_URL),
      });
      
      const fundTx = await masterClient.sendTransaction({
        to: walletInfo.address as `0x${string}`,
        value: parseEther("0.0002"),
      });
      await publicClient.waitForTransactionReceipt({ hash: fundTx });
      console.log(`      ✅ Funded`);
      await new Promise(r => setTimeout(r, 3000));
    }
    
    // Transfer SEND
    console.log(`\n   📤 Transferring ${formatUnits(sendBalance, 18)} SEND...`);
    const txHash = await walletClient.writeContract({
      address: SEND_TOKEN as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [RECEIVER_WALLET as `0x${string}`, sendBalance],
    });
    
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`      ✅ Success! TX: ${txHash}`);
    
    // Recover ETH
    const finalEth = await publicClient.getBalance({ address: walletInfo.address as `0x${string}` });
    if (finalEth > parseEther("0.0001")) {
      console.log(`\n   💸 Recovering ETH...`);
      const masterAccount = privateKeyToAccount(MASTER_PRIVATE_KEY as `0x${string}`);
      const ethTx = await walletClient.sendTransaction({
        to: masterAccount.address,
        value: finalEth - parseEther("0.00001"),
      });
      await publicClient.waitForTransactionReceipt({ hash: ethTx });
      console.log(`      ✅ Done`);
    }
    
    return { success: true };
    
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message?.substring(0, 150)}`);
    return { success: false };
  }
}

async function main() {
  console.log(`\n${"#".repeat(60)}`);
  console.log(`🚀 Token Recovery - New Mnemonic`);
  console.log(`${"#".repeat(60)}`);
  console.log(`\nMnemonic: ${MASTER_MNEMONIC.substring(0, 30)}...`);
  console.log(`Receiver: ${RECEIVER_WALLET}\n`);
  
  let recovered = 0;
  let failed = 0;
  
  for (const wallet of WALLETS_WITH_TOKENS) {
    const result = await recoverWallet(wallet);
    if (result.success) recovered++;
    else failed++;
    
    await new Promise(r => setTimeout(r, 5000));
  }
  
  console.log(`\n${"#".repeat(60)}`);
  console.log(`📊 Summary: ${recovered} recovered, ${failed} failed`);
  console.log(`${"#".repeat(60)}\n`);
}

main().catch(console.error);
