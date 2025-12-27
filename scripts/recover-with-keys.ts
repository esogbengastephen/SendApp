/**
 * Recovery script where you provide private keys directly
 */
import { createWalletClient, createPublicClient, http, parseEther, formatEther, formatUnits } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const BASE_RPC_URL = "https://mainnet.base.org";
const RECEIVER_WALLET = "0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0";
const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const USDC_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// YOU NEED TO FILL IN THE PRIVATE KEYS FOR EACH WALLET
// Get these from your secure storage or derive them using your method
const WALLET_KEYS: Record<string, string> = {
  "0x6905325f09Bd165C6F983519070979b9F4B232ec": "PRIVATE_KEY_HERE",
  "0x20717a8732d3341201fa33a06bbe5ed91dbfdeb2": "PRIVATE_KEY_HERE",
  "0xed77e10dd5158ED24c8857E1e7894FBe30D8f88c": "PRIVATE_KEY_HERE",
  "0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2": "PRIVATE_KEY_HERE",
  "0xCadCda9Ae9f84B865c18dF5af43E60CaE0b31A52": "PRIVATE_KEY_HERE",
  "0x4Ff937F3Cd784F4024A311B195f5007935537DC7": "PRIVATE_KEY_HERE",
  "0xFa5d32A62feFD8d6609464EdeFbb68Ecd7a26cC4": "PRIVATE_KEY_HERE",
  "0x6a2276395B8C617463f3C1574Cb57E82EcbF0522": "PRIVATE_KEY_HERE",
  "0x6459AE03e607E9F1A62De6bC17b6977a9F922679": "PRIVATE_KEY_HERE",
};

const MASTER_PRIVATE_KEY = process.argv[2] || "0xdd1c5205c271b34bb13ccf01cea87c1bca3add3cc04a4fa21bc1e0ad8d07a85f";

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
    
    // Get private key
    const privateKey = WALLET_KEYS[wallet] || WALLET_KEYS[wallet.toLowerCase()];
    
    if (!privateKey || privateKey === "PRIVATE_KEY_HERE") {
      console.log(`  ❌ Private key not provided`);
      console.log(`  ℹ️  Please add the private key for this wallet to WALLET_KEYS in the script`);
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
    console.error(`  ❌ ${error.message?.substring(0, 150)}`);
    return { success: false, transferred: 0 };
  }
}

async function main() {
  console.log(`\n${"#".repeat(60)}`);
  console.log(`🚀 Token Recovery (with Private Keys)`);
  console.log(`${"#".repeat(60)}\n`);
  console.log(`⚠️  IMPORTANT: You need to add the private keys to WALLET_KEYS`);
  console.log(`⚠️  in this script file before running.\n`);
  
  const wallets = Object.keys(WALLET_KEYS);
  console.log(`📋 ${wallets.length} wallets configured\n`);
  
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
