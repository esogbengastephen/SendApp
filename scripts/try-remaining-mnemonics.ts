/**
 * Try other mnemonics for remaining wallets
 */
import { ethers } from "ethers";
import { createWalletClient, createPublicClient, http, parseEther, formatUnits } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const OTHER_MNEMONICS = [
  "plate capable vocal jacket arch limit slim ketchup travel nation mistake acid",
  "logic choose ketchup over pen forum cupboard unhappy wool punch robot crew",
];

const MASTER_PRIVATE_KEY = "0x4ad77fb017847c51258c59f4c348b179a63d6d225d7857987b57c906c5f10c40";
const BASE_RPC_URL = "https://mainnet.base.org";
const RECEIVER = "0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0";
const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";

const REMAINING_WALLETS = [
  { address: "0x6905325f09Bd165C6F983519070979b9F4B232ec", txId: "offramp_NpVxYXVB0l6s" },
  { address: "0x6459AE03e607E9F1A62De6bC17b6977a9F922679", txId: "offramp_60r306ZKCtk2" },
];

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
  console.log(`🚀 Try Other Mnemonics for Remaining Wallets`);
  console.log(`${"#".repeat(60)}\n`);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });
  
  let recovered = 0;
  
  for (const wallet of REMAINING_WALLETS) {
    console.log(`${"=".repeat(60)}`);
    console.log(`🔄 ${wallet.address}`);
    
    try {
      const sendBalance = await publicClient.readContract({
        address: SEND_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [wallet.address as `0x${string}`],
      }) as bigint;
      
      console.log(`   SEND: ${formatUnits(sendBalance, 18)}`);
      
      if (sendBalance === 0n) {
        console.log(`   ✅ Empty\n`);
        continue;
      }
      
      // Try each mnemonic
      let matchedKey: string | null = null;
      let matchedMnemonic = "";
      
      for (let i = 0; i < OTHER_MNEMONICS.length; i++) {
        try {
          const derived = deriveFromTransaction(OTHER_MNEMONICS[i], wallet.txId);
          if (derived.address.toLowerCase() === wallet.address.toLowerCase()) {
            console.log(`   ✅ MATCH with mnemonic ${i + 1}!`);
            matchedKey = derived.privateKey;
            matchedMnemonic = OTHER_MNEMONICS[i].substring(0, 30);
            break;
          }
        } catch (e) {}
      }
      
      if (!matchedKey) {
        console.log(`   ❌ No match with any mnemonic\n`);
        continue;
      }
      
      // Transfer
      const account = privateKeyToAccount(matchedKey as `0x${string}`);
      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http(BASE_RPC_URL),
      });
      
      const ethBalance = await publicClient.getBalance({ address: wallet.address as `0x${string}` });
      const minGas = parseEther("0.00002");
      
      if (ethBalance < minGas) {
        const masterAccount = privateKeyToAccount(MASTER_PRIVATE_KEY as `0x${string}`);
        const masterClient = createWalletClient({
          account: masterAccount,
          chain: base,
          transport: http(BASE_RPC_URL),
        });
        
        console.log(`   💰 Funding gas...`);
        const fundTx = await masterClient.sendTransaction({
          to: wallet.address as `0x${string}`,
          value: parseEther("0.00003"),
        });
        await publicClient.waitForTransactionReceipt({ hash: fundTx });
        console.log(`      ✅ Funded`);
        await new Promise(r => setTimeout(r, 2000));
      }
      
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
  console.log(`📊 TOTAL: 180 + ${recovered} = ${180 + recovered} SEND`);
  console.log(`${"#".repeat(60)}\n`);
  
  if (recovered < REMAINING_WALLETS.length) {
    console.log(`⚠️  Some wallets still couldn't be recovered.`);
    console.log(`   They may need manual private keys.\n`);
  }
}

main().catch(console.error);
