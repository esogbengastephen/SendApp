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
const SEND_TOKEN_1 = getAddress('0xEab49138BA2Ea6dd776220fE26b7b8E446638956'); // From database
const SEND_TOKEN_2 = getAddress('0x3f14920c99BEB920Afa163031c4e47a3e03B3e4A'); // From constants

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const erc20Abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
]);

async function compareSendTokens() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 COMPARING TWO "SEND" TOKEN ADDRESSES`);
  console.log(`${"=".repeat(80)}\n`);

  console.log(`TOKEN 1 (From Database):`);
  console.log(`Address: ${SEND_TOKEN_1}`);
  console.log(`BaseScan: https://basescan.org/token/${SEND_TOKEN_1}`);
  
  try {
    const name1 = await publicClient.readContract({
      address: SEND_TOKEN_1,
      abi: erc20Abi,
      functionName: 'name',
    });
    const symbol1 = await publicClient.readContract({
      address: SEND_TOKEN_1,
      abi: erc20Abi,
      functionName: 'symbol',
    });
    console.log(`Name: ${name1}`);
    console.log(`Symbol: ${symbol1}\n`);
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}\n`);
  }

  console.log(`TOKEN 2 (From constants.ts):`);
  console.log(`Address: ${SEND_TOKEN_2}`);
  console.log(`BaseScan: https://basescan.org/token/${SEND_TOKEN_2}`);
  
  try {
    const name2 = await publicClient.readContract({
      address: SEND_TOKEN_2,
      abi: erc20Abi,
      functionName: 'name',
    });
    const symbol2 = await publicClient.readContract({
      address: SEND_TOKEN_2,
      abi: erc20Abi,
      functionName: 'symbol',
    });
    console.log(`Name: ${name2}`);
    console.log(`Symbol: ${symbol2}\n`);
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}\n`);
  }

  console.log(`${"=".repeat(80)}\n`);
}

compareSendTokens().catch(console.error);
