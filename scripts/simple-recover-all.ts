/**
 * Simple recovery script that directly specifies the mnemonic
 */
import { createWalletClient, createPublicClient, http, parseEther, formatEther, Wallet } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount, mnemonicToAccount } from "viem/accounts";
import { scanWalletForAllTokens } from "../lib/wallet-scanner";

const BASE_RPC_URL = "https://mainnet.base.org";
const RECEIVER_WALLET = "0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0";

// You'll need to provide the mnemonic as a command line argument for security
const MASTER_MNEMONIC = process.argv[2];
const MASTER_WALLET_KEY = process.argv[3];

if (!MASTER_MNEMONIC) {
  console.error("\n❌ Error: Master mnemonic required");
  console.error('Usage: npx tsx scripts/simple-recover-all.ts "your twelve word mnemonic phrase" "0xMasterPrivateKey"\n');
  process.exit(1);
}

if (!MASTER_WALLET_KEY) {
  console.error("\n❌ Error: Master wallet private key required (for gas funding)");
  console.error('Usage: npx tsx scripts/simple-recover-all.ts "your twelve word mnemonic phrase" "0xMasterPrivateKey"\n');
  process.exit(1);
}

// All offramp wallets from database
const WALLETS = [
  "0x6905325f09Bd165C6F983519070979b9F4B232ec",
  "0x20717a8732d3341201fa33a06bbe5ed91dbfdeb2",
  "0xed77e10dd5158ED24c8857E1e7894FBe30D8f88c",
  "0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2",
  "0x522B6B6cE859c5e5e335d504e2B6878aD8f9a884",
  "0xCadCda9Ae9f84B865c18dF5af43E60CaE0b31A52",
  "0x4Ff937F3Cd784F4024A311B195f5007935537DC7",
  "0xFa5d32A62feFD8d6609464EdeFbb68Ecd7a26cC4",
  "0x6a2276395B8C617463f3C1574Cb57E82EcbF0522",
  "0x6459AE03e607E9F1A62De6bC17b6977a9F922679",
];

const ERC20_ABI = [
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

async function deriveWalletKey(walletAddress: string): Promise<string | null> {
  console.log(`\n  🔑 Trying to derive key for ${walletAddress}...`);
  
  // Try different derivation paths
  const pathsToTry = [
    `m/44'/60'/0'/0/0`,   // Default
    `m/44'/60'/0'/0/1`,
    `m/44'/60'/0'/0/2`,
    `m/44'/60'/0'/0/3`,
    `m/44'/60'/0'/0/4`,
    `m/44'/60'/0'/0/5`,
    `m/44'/60'/1'/0/0`,
    `m/44'/60'/2'/0/0`,
  ];
  
  for (const path of pathsToTry) {
    try {
      const account = mnemonicToAccount(MASTER_MNEMONIC, { path });
      if (account.address.toLowerCase() === walletAddress.toLowerCase()) {
        console.log(`     ✅ Found at path: ${path}`);
        return account.getHdKey().privateKey!;
      }
    } catch (error) {
      // Continue trying
    }
  }
  
  console.log(`     ❌ Could not derive key`);
  return null;
}

async function recoverWallet(walletAddress: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔄 ${walletAddress}`);
  console.log(`${"=".repeat(60)}`);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });
  
  // Scan for tokens
  console.log(`  📡 Scanning...`);
  const tokens = await scanWalletForAllTokens(walletAddress);
  
  if (tokens.length === 0) {
    const ethBalance = await publicClient.getBalance({ address: walletAddress as `0x${string}` });
    if (ethBalance === 0n) {
      console.log(`  ✅ Already empty`);
      return { success: true, transferred: 0 };
    }
    console.log(`  ⚠️  Only has ${formatEther(ethBalance)} ETH`);
  } else {
    console.log(`  ✅ Found ${tokens.length} token(s):`);
    tokens.forEach((t, i) => console.log(`     ${i + 1}. ${t.symbol}: ${t.amount}`));
  }
  
  // Derive private key
  const privateKey = await deriveWalletKey(walletAddress);
  if (!privateKey) {
    console.log(`  ❌ Skipping (no key)`);
    return { success: false, transferred: 0 };
  }
  
  const account = privateKeyToAccount(("0x" + privateKey) as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(BASE_RPC_URL),
  });
  
  let transferred = 0;
  
  // Check if we need gas
  const ethBalance = await publicClient.getBalance({ address: walletAddress as `0x${string}` });
  const minGas = parseEther("0.0001");
  
  if (ethBalance < minGas && tokens.some(t => t.address)) {
    console.log(`  💰 Funding gas...`);
    const masterAccount = privateKeyToAccount(MASTER_WALLET_KEY as `0x${string}`);
    const masterClient = createWalletClient({
      account: masterAccount,
      chain: base,
      transport: http(BASE_RPC_URL),
    });
    
    const fundTx = await masterClient.sendTransaction({
      to: walletAddress as `0x${string}`,
      value: parseEther("0.0002"),
    });
    await publicClient.waitForTransactionReceipt({ hash: fundTx });
    console.log(`     ✅ Funded`);
  }
  
  // Transfer ERC20 tokens
  for (const token of tokens.filter(t => t.address)) {
    try {
      console.log(`\n  📤 Transferring ${token.symbol}...`);
      const txHash = await walletClient.writeContract({
        address: token.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [RECEIVER_WALLET as `0x${string}`, BigInt(token.amountRaw)],
      });
      
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(`     ✅ Transferred ${token.amount} ${token.symbol}`);
      transferred++;
    } catch (error: any) {
      console.error(`     ❌ Error: ${error.message?.substring(0, 100)}`);
    }
  }
  
  // Recover ETH
  const finalEth = await publicClient.getBalance({ address: walletAddress as `0x${string}` });
  if (finalEth > parseEther("0.0001")) {
    console.log(`\n  💸 Recovering ETH...`);
    try {
      const masterAccount = privateKeyToAccount(MASTER_WALLET_KEY as `0x${string}`);
      const ethToRecover = finalEth - parseEther("0.00001");
      
      const ethTx = await walletClient.sendTransaction({
        to: masterAccount.address,
        value: ethToRecover,
      });
      await publicClient.waitForTransactionReceipt({ hash: ethTx });
      console.log(`     ✅ Recovered ${formatEther(ethToRecover)} ETH`);
    } catch (error: any) {
      console.error(`     ❌ Error: ${error.message?.substring(0, 100)}`);
    }
  }
  
  console.log(`\n  ✅ Complete (${transferred} tokens transferred)`);
  return { success: true, transferred };
}

async function main() {
  console.log(`\n${"#".repeat(60)}`);
  console.log(`🚀 Token Recovery Script`);
  console.log(`${"#".repeat(60)}`);
  console.log(`\n📬 All tokens will go to: ${RECEIVER_WALLET}\n`);
  
  let totalTransferred = 0;
  
  for (const wallet of WALLETS) {
    const result = await recoverWallet(wallet);
    totalTransferred += result.transferred;
    
    // Wait between wallets
    if (wallet !== WALLETS[WALLETS.length - 1]) {
      console.log(`\n⏳ Waiting 3 seconds...\n`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log(`\n${"#".repeat(60)}`);
  console.log(`📊 Summary: ${totalTransferred} tokens recovered`);
  console.log(`${"#".repeat(60)}\n`);
}

main().catch(console.error);
