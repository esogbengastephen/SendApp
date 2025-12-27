import { createPublicClient, http, getAddress } from 'viem';
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
const TX_HASH = '0x6ff074926943cc33957facb4e45c51984fc6e49ca6c5a11c4c3422e1e3d93c46';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

async function analyzeRevert() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 ANALYZING REVERTED TRANSACTION`);
  console.log(`${"=".repeat(80)}\n`);

  console.log(`TX Hash: ${TX_HASH}`);
  console.log(`BaseScan: https://basescan.org/tx/${TX_HASH}\n`);

  try {
    const tx = await publicClient.getTransaction({ hash: TX_HASH as `0x${string}` });
    const receipt = await publicClient.getTransactionReceipt({ hash: TX_HASH as `0x${string}` });

    console.log(`From: ${tx.from}`);
    console.log(`To: ${tx.to}`);
    console.log(`Value: ${tx.value.toString()} wei`);
    console.log(`Gas Limit: ${tx.gas.toString()}`);
    console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`Status: ${receipt.status}`);
    console.log(`\nBlock Number: ${receipt.blockNumber.toString()}`);

    console.log(`\n${"-".repeat(80)}`);
    console.log(`\n💡 DIAGNOSIS:`);
    
    if (receipt.status === 'reverted') {
      console.log(`❌ Transaction REVERTED on-chain`);
      console.log(`\n   This means the smart contract rejected the transaction.`);
      console.log(`   Common reasons:`);
      console.log(`   - Insufficient token balance (but we confirmed there's 10 SEND)`);
      console.log(`   - Token not approved for the swap contract`);
      console.log(`   - Slippage too high`);
      console.log(`   - Invalid swap route`);
      console.log(`\n   Check BaseScan for the exact revert reason:`);
      console.log(`   https://basescan.org/tx/${TX_HASH}`);
    }

    console.log(`\n${"=".repeat(80)}\n`);
  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
  }
}

analyzeRevert().catch(console.error);
