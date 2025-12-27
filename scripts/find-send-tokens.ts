import { createPublicClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';

const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const RECEIVER = "0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0";

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

async function findTokens() {
  console.log(`\n🔍 Checking for available SEND tokens...\n`);
  
  const receiverBalance = await publicClient.readContract({
    address: SEND_TOKEN as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [RECEIVER as `0x${string}`],
  });
  
  console.log(`Receiver Wallet (${RECEIVER}):`);
  console.log(`  SEND: ${formatUnits(receiverBalance, 18)}`);
  
  if (receiverBalance > 0n) {
    console.log(`\n✅ Can send test tokens from receiver wallet!`);
  } else {
    console.log(`\n⚠️  No SEND tokens available in receiver wallet.`);
    console.log(`\nPlease send SEND tokens manually to test wallet.`);
  }
}

findTokens().catch(console.error);
