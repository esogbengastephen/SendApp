/**
 * Final attempt at last 2 wallets
 */
import { ethers } from "ethers";
import { createWalletClient, createPublicClient, http, formatUnits, formatEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const MNEMONIC_2 = "logic choose ketchup over pen forum cupboard unhappy wool punch robot crew";
const BASE_RPC_URL = "https://mainnet.base.org";
const RECEIVER = "0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0";
const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";

const WALLET_1 = {
  address: "0x6459AE03e607E9F1A62De6bC17b6977a9F922679",
  txId: "offramp_60r306ZKCtk2",
  mnemonic: MNEMONIC_2,
};

const WALLET_2 = {
  address: "0x6905325f09Bd165C6F983519070979b9F4B232ec",
  send: "5",
  // This one needs manual private key
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
] as const;

function deriveFromTransaction(mnemonic: string, txId: string) {
  const indexHash = ethers.keccak256(ethers.toUtf8Bytes(txId));
  const indexNumber = BigInt(indexHash) % BigInt(2147483647);
  const mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic);
  const seed = mnemonicObj.computeSeed();
  const rootNode = ethers.HDNodeWallet.fromSeed(seed);
  const wallet = rootNode.derivePath(`m/44'/60'/0'/0/${indexNumber}`);
  return { address: wallet.address, privateKey: wallet.privateKey };
}

async function main() {
  console.log(`\n${"#".repeat(60)}`);
  console.log(`🚀 Final Two Wallets`);
  console.log(`${"#".repeat(60)}\n`);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });
  
  // Try wallet 1
  console.log(`${"=".repeat(60)}`);
  console.log(`🔄 Wallet 1: ${WALLET_1.address}`);
  
  try {
    const sendBalance = await publicClient.readContract({
      address: SEND_TOKEN as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [WALLET_1.address as `0x${string}`],
    }) as bigint;
    
    const ethBalance = await publicClient.getBalance({ address: WALLET_1.address as `0x${string}` });
    
    console.log(`   SEND: ${formatUnits(sendBalance, 18)}`);
    console.log(`   ETH: ${formatEther(ethBalance)}`);
    
    if (sendBalance === 0n) {
      console.log(`   ✅ Already empty\n`);
    } else {
      // Derive key
      const derived = deriveFromTransaction(WALLET_1.mnemonic, WALLET_1.txId);
      console.log(`   Derived: ${derived.address}`);
      
      if (derived.address.toLowerCase() === WALLET_1.address.toLowerCase()) {
        console.log(`   ✅ Match!`);
        
        // Check if it has enough ETH for gas
        if (ethBalance > 0n) {
          console.log(`   💎 Has ETH, attempting transfer...`);
          
          const account = privateKeyToAccount(derived.privateKey as `0x${string}`);
          const walletClient = createWalletClient({
            account,
            chain: base,
            transport: http(BASE_RPC_URL),
          });
          
          try {
            const txHash = await walletClient.writeContract({
              address: SEND_TOKEN as `0x${string}`,
              abi: ERC20_ABI,
              functionName: "transfer",
              args: [RECEIVER as `0x${string}`, sendBalance],
            });
            
            await publicClient.waitForTransactionReceipt({ hash: txHash });
            console.log(`   ✅ Success! ${formatUnits(sendBalance, 18)} SEND`);
            console.log(`   TX: ${txHash}\n`);
          } catch (error: any) {
            console.error(`   ❌ Transfer failed: ${error.message?.substring(0, 100)}`);
            console.log(`   ℹ️  Wallet needs more gas funding\n`);
          }
        } else {
          console.log(`   ❌ No ETH for gas\n`);
        }
      } else {
        console.log(`   ❌ Address mismatch\n`);
      }
    }
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message?.substring(0, 100)}\n`);
  }
  
  // Check wallet 2
  console.log(`${"=".repeat(60)}`);
  console.log(`🔄 Wallet 2: ${WALLET_2.address}`);
  
  try {
    const sendBalance = await publicClient.readContract({
      address: SEND_TOKEN as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [WALLET_2.address as `0x${string}`],
    }) as bigint;
    
    const ethBalance = await publicClient.getBalance({ address: WALLET_2.address as `0x${string}` });
    
    console.log(`   SEND: ${formatUnits(sendBalance, 18)}`);
    console.log(`   ETH: ${formatEther(ethBalance)}`);
    console.log(`   ⚠️  No mnemonic match - needs manual private key\n`);
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message?.substring(0, 100)}\n`);
  }
  
  console.log(`${"#".repeat(60)}`);
  console.log(`📊 Current Total: 180 SEND recovered`);
  console.log(`📊 Remaining: 15 SEND (needs gas funding or manual keys)`);
  console.log(`${"#".repeat(60)}\n`);
}

main().catch(console.error);
