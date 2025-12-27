import { createPublicClient, http, formatEther, formatUnits, parseAbi } from 'viem';
import { base } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
const WALLET = '0x9317ff359B6Ef71cD945cA791691e8806815b8d9';
const SEND_TOKEN = '0x3f14920c99BEB920Afa163031c4e47a3e03B3e4A';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]);

async function diagnose() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 DIAGNOSING REVERT FOR WALLET: ${WALLET}`);
  console.log(`${"=".repeat(80)}\n`);

  // Check ETH balance
  const ethBalance = await publicClient.getBalance({ address: WALLET as `0x${string}` });
  console.log(`ETH Balance: ${formatEther(ethBalance)} ETH`);

  // Check SEND balance
  const sendBalance = await publicClient.readContract({
    address: SEND_TOKEN as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [WALLET as `0x${string}`],
  });
  console.log(`SEND Balance: ${formatUnits(sendBalance as bigint, 18)} SEND`);

  console.log(`\n${"-".repeat(80)}`);
  console.log(`\n💡 DIAGNOSIS:`);
  
  if (sendBalance === 0n) {
    console.log(`❌ PROBLEM: Wallet has 0 SEND tokens!`);
    console.log(`   The tokens might have been sent to a different address.`);
  } else {
    console.log(`✅ Wallet has SEND tokens: ${formatUnits(sendBalance as bigint, 18)}`);
  }

  if (ethBalance === 0n) {
    console.log(`❌ PROBLEM: Wallet has 0 ETH for gas!`);
  } else {
    console.log(`✅ Wallet has ETH: ${formatEther(ethBalance)}`);
  }

  console.log(`\n${"=".repeat(80)}\n`);
}

diagnose().catch(console.error);
