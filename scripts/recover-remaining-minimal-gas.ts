/**
 * Recover remaining wallets with minimal gas
 */
import { ethers } from "ethers";
import { createWalletClient, createPublicClient, http, parseEther, formatUnits, formatEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const MASTER_MNEMONIC = "spray poem meat special horror cousin parrot number student file target area";
const MASTER_PRIVATE_KEY = "0x4ad77fb017847c51258c59f4c348b179a63d6d225d7857987b57c906c5f10c40";
const BASE_RPC_URL = "https://mainnet.base.org";
const RECEIVER = "0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0";
const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";

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

// Remaining wallets with tokens (with known tx IDs)
const WALLETS = [
  { address: "0x4Ff937F3Cd784F4024A311B195f5007935537DC7", txId: "offramp_cuJiQ1nt8-jt", send: "10" },
  { address: "0xFa5d32A62feFD8d6609464EdeFbb68Ecd7a26cC4", txId: "offramp_6MDOT5FROvi2", send: "10" },
  { address: "0x6a2276395B8C617463f3C1574Cb57E82EcbF0522", txId: "offramp_XHJH04ovkPI3", send: "10" },
  { address: "0x6905325f09Bd165C6F983519070979b9F4B232ec", txId: "offramp_NpVxYXVB0l6s", send: "5" },
  { address: "0x6459AE03e607E9F1A62De6bC17b6977a9F922679", txId: "offramp_60r306ZKCtk2", send: "10" },
];

function deriveFromTransaction(txId: string) {
  const indexHash = ethers.keccak256(ethers.toUtf8Bytes(txId));
  const indexNumber = BigInt(indexHash) % BigInt(2147483647);
  const mnemonic = ethers.Mnemonic.fromPhrase(MASTER_MNEMONIC);
  const seed = mnemonic.computeSeed();
  const rootNode = ethers.HDNodeWallet.fromSeed(seed);
  const wallet = rootNode.derivePath(`m/44'/60'/0'/0/${indexNumber}`);
  return { address: wallet.address, privateKey: wallet.privateKey };
}

async function main() {
  console.log(`\n${"#".repeat(60)}`);
  console.log(`🚀 Recover Remaining Wallets (Minimal Gas)`);
  console.log(`${"#".repeat(60)}\n`);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });
  
  // Check master wallet balance
  const masterAccount = privateKeyToAccount(MASTER_PRIVATE_KEY as `0x${string}`);
  const masterBalance = await publicClient.getBalance({ address: masterAccount.address });
  console.log(`💰 Master balance: ${formatEther(masterBalance)} ETH\n`);
  
  let recovered = 0;
  
  for (const wallet of WALLETS) {
    console.log(`${"=".repeat(60)}`);
    console.log(`🔄 ${wallet.address} (${wallet.send} SEND)`);
    
    try {
      // Verify it has tokens
      const sendBalance = await publicClient.readContract({
        address: SEND_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [wallet.address as `0x${string}`],
      }) as bigint;
      
      if (sendBalance === 0n) {
        console.log(`   ✅ Already empty\n`);
        continue;
      }
      
      console.log(`   📊 Has ${formatUnits(sendBalance, 18)} SEND`);
      
      // Try to derive private key
      const derived = deriveFromTransaction(wallet.txId);
      
      if (derived.address.toLowerCase() !== wallet.address.toLowerCase()) {
        console.log(`   ❌ Derivation mismatch\n`);
        continue;
      }
      
      console.log(`   ✅ Key derived`);
      
      // Create wallet client
      const account = privateKeyToAccount(derived.privateKey as `0x${string}`);
      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http(BASE_RPC_URL),
      });
      
      // Check if wallet needs gas
      const ethBalance = await publicClient.getBalance({ address: wallet.address as `0x${string}` });
      console.log(`   💎 Has ${formatEther(ethBalance)} ETH`);
      
      const minGas = parseEther("0.00002"); // Very minimal
      
      if (ethBalance < minGas) {
        // Check if master has enough
        const currentMasterBalance = await publicClient.getBalance({ address: masterAccount.address });
        const gasToSend = parseEther("0.00003"); // Send tiny amount
        
        if (currentMasterBalance > gasToSend) {
          console.log(`   💰 Funding minimal gas...`);
          const masterClient = createWalletClient({
            account: masterAccount,
            chain: base,
            transport: http(BASE_RPC_URL),
          });
          
          const fundTx = await masterClient.sendTransaction({
            to: wallet.address as `0x${string}`,
            value: gasToSend,
          });
          await publicClient.waitForTransactionReceipt({ hash: fundTx });
          console.log(`      ✅ Funded`);
          await new Promise(r => setTimeout(r, 2000));
        } else {
          console.log(`   ❌ Master wallet insufficient\n`);
          continue;
        }
      }
      
      // Transfer SEND
      console.log(`   📤 Transferring...`);
      const txHash = await walletClient.writeContract({
        address: SEND_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [RECEIVER as `0x${string}`, sendBalance],
      });
      
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(`   ✅ Success! ${formatUnits(sendBalance, 18)} SEND`);
      console.log(`   TX: ${txHash}\n`);
      
      recovered++;
      await new Promise(r => setTimeout(r, 5000));
      
    } catch (error: any) {
      console.error(`   ❌ ${error.message?.substring(0, 150)}\n`);
    }
  }
  
  console.log(`\n${"#".repeat(60)}`);
  console.log(`📊 Recovered ${recovered} more wallets`);
  console.log(`${"#".repeat(60)}\n`);
}

main().catch(console.error);
