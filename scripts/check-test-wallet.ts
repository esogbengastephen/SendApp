import { createPublicClient, http, formatEther, formatUnits } from 'viem';
import { base } from 'viem/chains';

const WALLET = "0xEc370c4556da79a25Fdbf90B74108b997CADeD63";
const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const USDC_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

async function checkWallet() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 TEST WALLET STATUS`);
  console.log(`${"=".repeat(80)}\n`);
  console.log(`Address: ${WALLET}`);
  console.log(`Transaction ID: offramp_5xXSFS-w56w-\n`);
  
  const ethBalance = await publicClient.getBalance({ address: WALLET as `0x${string}` });
  console.log(`Balances:`);
  console.log(`  ETH:  ${formatEther(ethBalance)}`);
  
  const sendBalance = await publicClient.readContract({
    address: SEND_TOKEN as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [WALLET as `0x${string}`],
  });
  console.log(`  SEND: ${formatUnits(sendBalance, 18)}`);
  
  const usdcBalance = await publicClient.readContract({
    address: USDC_TOKEN as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [WALLET as `0x${string}`],
  });
  console.log(`  USDC: ${formatUnits(usdcBalance, 6)}`);
  
  console.log(`\n${"=".repeat(80)}`);
  
  if (sendBalance > 0n) {
    console.log(`✅ READY TO TEST!`);
    console.log(`${"=".repeat(80)}\n`);
    console.log(`Wallet has ${formatUnits(sendBalance, 18)} SEND tokens!\n`);
    console.log(`Run the swap test:`);
    console.log(`\ncurl -X POST http://localhost:3000/api/offramp/swap-token \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"transactionId":"offramp_5xXSFS-w56w-"}'`);
    console.log(``);
  } else {
    console.log(`⚠️  WAITING FOR TOKENS`);
    console.log(`${"=".repeat(80)}\n`);
    console.log(`Please send SEND tokens to: ${WALLET}\n`);
    console.log(`Once sent, re-run this script to check status.`);
    console.log(``);
  }
}

checkWallet().catch(console.error);
