import { createPublicClient, http, formatEther, formatUnits, parseAbi, getAddress } from 'viem';
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
const WALLET = getAddress('0x9317ff359B6Ef71cD945cA791691e8806815b8d9');
const SEND_TOKEN = getAddress('0x3f14920c99BEB920Afa163031c4e47a3e03B3e4A');

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
]);

async function check() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 CHECKING DATABASE WALLET (PROPERLY CHECKSUMMED)`);
  console.log(`${"=".repeat(80)}\n`);

  console.log(`Wallet: ${WALLET}`);
  console.log(`BaseScan: https://basescan.org/address/${WALLET}\n`);

  const ethBalance = await publicClient.getBalance({ address: WALLET });
  const sendBalance = await publicClient.readContract({
    address: SEND_TOKEN,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [WALLET],
  });
  
  console.log(`ETH Balance: ${formatEther(ethBalance)} ETH`);
  console.log(`SEND Balance: ${formatUnits(sendBalance as bigint, 18)} SEND`);

  console.log(`\n${"=".repeat(80)}\n`);
}

check().catch(console.error);
