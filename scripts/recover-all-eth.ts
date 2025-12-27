/**
 * Recover ALL ETH from successfully recovered wallets to receiver
 */
import { ethers } from "ethers";
import { createWalletClient, createPublicClient, http, parseEther, formatEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const MASTER_MNEMONIC = "spray poem meat special horror cousin parrot number student file target area";
const BASE_RPC_URL = "https://mainnet.base.org";
const RECEIVER = "0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0";

// Successfully recovered wallets
const WALLETS = [
  { address: "0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2", txId: "offramp_Y81PZ3oLNTjY" },
  { address: "0xCadCda9Ae9f84B865c18dF5af43E60CaE0b31A52", txId: "offramp_dx-jR2PcVRl3" },
  { address: "0x4Ff937F3Cd784F4024A311B195f5007935537DC7", txId: "offramp_cuJiQ1nt8-jt" },
  { address: "0xFa5d32A62feFD8d6609464EdeFbb68Ecd7a26cC4", txId: "offramp_6MDOT5FROvi2" },
  { address: "0x6a2276395B8C617463f3C1574Cb57E82EcbF0522", txId: "offramp_XHJH04ovkPI3" },
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
  console.log(`💎 Recover ALL ETH to Receiver`);
  console.log(`${"#".repeat(60)}\n`);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });
  
  let totalEthRecovered = 0n;
  
  for (const wallet of WALLETS) {
    console.log(`${"=".repeat(60)}`);
    console.log(`🔄 ${wallet.address}`);
    
    try {
      const ethBalance = await publicClient.getBalance({ address: wallet.address as `0x${string}` });
      console.log(`   ETH: ${formatEther(ethBalance)}`);
      
      if (ethBalance === 0n) {
        console.log(`   ✅ Already 0.0 ETH\n`);
        continue;
      }
      
      // Derive private key
      const derived = deriveFromTransaction(wallet.txId);
      
      if (derived.address.toLowerCase() !== wallet.address.toLowerCase()) {
        console.log(`   ❌ Key mismatch\n`);
        continue;
      }
      
      const account = privateKeyToAccount(derived.privateKey as `0x${string}`);
      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http(BASE_RPC_URL),
      });
      
      // Estimate gas
      const gasPrice = await publicClient.getGasPrice();
      const estimatedGas = BigInt(21000);
      const gasCost = gasPrice * estimatedGas;
      
      if (ethBalance <= gasCost) {
        console.log(`   ⚠️  Balance too low to cover gas\n`);
        continue;
      }
      
      // Send all ETH minus gas cost
      const ethToSend = ethBalance - gasCost;
      
      console.log(`   📤 Sending ${formatEther(ethToSend)} ETH...`);
      
      const txHash = await walletClient.sendTransaction({
        to: RECEIVER as `0x${string}`,
        value: ethToSend,
        gas: estimatedGas,
      });
      
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(`   ✅ Sent!`);
      console.log(`   TX: ${txHash}`);
      
      totalEthRecovered += ethToSend;
      
      // Verify wallet is now empty
      const finalBalance = await publicClient.getBalance({ address: wallet.address as `0x${string}` });
      console.log(`   Final: ${formatEther(finalBalance)} ETH\n`);
      
      await new Promise(r => setTimeout(r, 3000));
      
    } catch (error: any) {
      console.error(`   ❌ ${error.message?.substring(0, 100)}\n`);
    }
  }
  
  console.log(`\n${"#".repeat(60)}`);
  console.log(`💎 Total ETH recovered: ${formatEther(totalEthRecovered)}`);
  console.log(`📬 Sent to: ${RECEIVER}`);
  console.log(`${"#".repeat(60)}\n`);
}

main().catch(console.error);
