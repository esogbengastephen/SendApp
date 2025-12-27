import { createPublicClient, http, formatEther, getAddress } from 'viem';
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
const TEST_WALLET = getAddress('0x9317ff359B6Ef71cD945cA791691e8806815b8d9');
const MASTER_WALLET = getAddress(process.env.OFFRAMP_ADMIN_WALLET_ADDRESS || '0x0');

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

async function checkRecovery() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 CHECKING ETH RECOVERY STATUS`);
  console.log(`${"=".repeat(80)}\n`);

  const testBalance = await publicClient.getBalance({ address: TEST_WALLET });
  const masterBalance = await publicClient.getBalance({ address: MASTER_WALLET });

  console.log(`Test Wallet: ${TEST_WALLET}`);
  console.log(`ETH Balance: ${formatEther(testBalance)} ETH\n`);

  console.log(`Master Wallet: ${MASTER_WALLET}`);
  console.log(`ETH Balance: ${formatEther(masterBalance)} ETH\n`);

  console.log(`${"=".repeat(80)}`);
  
  if (testBalance > 0n) {
    const balanceInEth = parseFloat(formatEther(testBalance));
    console.log(`\n⚠️  Test wallet still has ${balanceInEth.toFixed(6)} ETH`);
    console.log(`💡 This ETH was NOT recovered automatically`);
    console.log(`\n📝 Recommendation: Implement automatic ETH recovery after successful swaps`);
  } else {
    console.log(`\n✅ Test wallet is empty - ETH was recovered!`);
  }

  console.log(`\n${"=".repeat(80)}\n`);
}

checkRecovery().catch(console.error);
