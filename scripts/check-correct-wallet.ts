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
const WALLET_DB = '0x9317ff359B6Ef71cD945cA791691e8806815b8d9'; // From database
const WALLET_SCREENSHOT = '0x9317f735986F71cd945c47916916b886815b8d9'; // From screenshot

const SEND_TOKEN = '0x3f14920c99BEB920Afa163031c4e47a3e03B3e4A';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
]);

async function checkBoth() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 COMPARING TWO WALLET ADDRESSES`);
  console.log(`${"=".repeat(80)}\n`);

  console.log(`Database Wallet:    ${WALLET_DB}`);
  console.log(`Screenshot Wallet:  ${WALLET_SCREENSHOT}`);
  console.log(`\nAre they the same? ${WALLET_DB.toLowerCase() === WALLET_SCREENSHOT.toLowerCase() ? 'YES ✅' : 'NO ❌'}\n`);

  // Check SEND balance in DB wallet
  const sendBalanceDB = await publicClient.readContract({
    address: SEND_TOKEN as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [WALLET_DB as `0x${string}`],
  });
  
  console.log(`Database Wallet SEND Balance: ${formatUnits(sendBalanceDB as bigint, 18)} SEND`);

  // Check SEND balance in screenshot wallet
  const sendBalanceScreenshot = await publicClient.readContract({
    address: SEND_TOKEN as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [WALLET_SCREENSHOT as `0x${string}`],
  });
  
  console.log(`Screenshot Wallet SEND Balance: ${formatUnits(sendBalanceScreenshot as bigint, 18)} SEND`);

  console.log(`\n${"=".repeat(80)}`);
  console.log(`💡 DIAGNOSIS:`);
  
  if (sendBalanceDB > 0n) {
    console.log(`✅ Tokens are in DATABASE wallet`);
  } else if (sendBalanceScreenshot > 0n) {
    console.log(`❌ Tokens are in SCREENSHOT wallet (WRONG WALLET IN DB!)`);
  } else {
    console.log(`❌ Tokens not found in either wallet!`);
  }
  console.log(`${"=".repeat(80)}\n`);
}

checkBoth().catch(console.error);
