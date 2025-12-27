import { createPublicClient, http } from 'viem';
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
const TX_HASH = '0x5842a919e57c0d9235a95c0a78d60ffc078684914136e289f770e3dc8bf41859';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const AERODROME_ROUTER = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43';
const ZEROX_EXCHANGE_PROXY = '0x785648669b8e90a75a6a8de682258957f9028462';

async function analyze() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 ANALYZING NEW REVERTED TRANSACTION`);
  console.log(`${"=".repeat(80)}\n`);

  const tx = await publicClient.getTransaction({ hash: TX_HASH as `0x${string}` });
  const receipt = await publicClient.getTransactionReceipt({ hash: TX_HASH as `0x${string}` });

  console.log(`TX: ${TX_HASH}`);
  console.log(`BaseScan: https://basescan.org/tx/${TX_HASH}\n`);
  console.log(`From: ${tx.from}`);
  console.log(`To: ${tx.to}`);
  console.log(`Status: ${receipt.status}`);
  console.log(`Gas Used: ${receipt.gasUsed.toString()}\n`);

  if (tx.to?.toLowerCase() === AERODROME_ROUTER.toLowerCase()) {
    console.log(`🎯 CONTRACT: Aerodrome Router (LAYER 3)`);
    console.log(`   ✅ Good! System tried Aerodrome fallback`);
  } else if (tx.to?.toLowerCase() === ZEROX_EXCHANGE_PROXY.toLowerCase()) {
    console.log(`🎯 CONTRACT: 0x Exchange Proxy (LAYER 1 or 2)`);
    console.log(`   ⚠️  System tried 0x, not Aerodrome`);
  } else {
    console.log(`🎯 CONTRACT: ${tx.to}`);
    console.log(`   ❓ Unknown contract`);
  }

  console.log(`\n${"=".repeat(80)}\n`);
}

analyze().catch(console.error);
