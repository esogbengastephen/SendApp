import { createPublicClient, http, parseAbi, getAddress } from 'viem';
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
const MYSTERY_TOKEN = getAddress('0xEab49138BA2Ea6dd776220fE26b7b8E446638956');
const WALLET = getAddress('0x9317ff359B6Ef71cD945cA791691e8806815b8d9');

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const erc20Abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
]);

async function identifyToken() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 IDENTIFYING MYSTERY TOKEN`);
  console.log(`${"=".repeat(80)}\n`);

  console.log(`Token Address: ${MYSTERY_TOKEN}`);
  console.log(`BaseScan: https://basescan.org/token/${MYSTERY_TOKEN}\n`);

  try {
    const name = await publicClient.readContract({
      address: MYSTERY_TOKEN,
      abi: erc20Abi,
      functionName: 'name',
    });

    const symbol = await publicClient.readContract({
      address: MYSTERY_TOKEN,
      abi: erc20Abi,
      functionName: 'symbol',
    });

    const decimals = await publicClient.readContract({
      address: MYSTERY_TOKEN,
      abi: erc20Abi,
      functionName: 'decimals',
    });

    const balance = await publicClient.readContract({
      address: MYSTERY_TOKEN,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [WALLET],
    });

    console.log(`Token Name: ${name}`);
    console.log(`Token Symbol: ${symbol}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`\nBalance in wallet ${WALLET}:`);
    console.log(`Raw: ${balance.toString()}`);
    console.log(`Formatted: ${Number(balance) / (10 ** Number(decimals))} ${symbol}`);

    console.log(`\n${"=".repeat(80)}`);
    console.log(`\n💡 This is ${symbol} token, NOT SEND!`);
    console.log(`\n${"=".repeat(80)}\n`);
  } catch (error: any) {
    console.error(`\n❌ Error reading token:`, error.message);
  }
}

identifyToken().catch(console.error);
