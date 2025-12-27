import { createPublicClient, http, formatUnits } from 'viem';
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
const WALLET_ADDRESS = '0x9317ff359B6Ef71cD945cA791691e8806815b8d9';
const SEND_TOKEN = '0xEab49138BA2Ea6dd776220fE26b7b8E446638956';
const AERODROME_ROUTER = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const erc20Abi = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: 'remaining', type: 'uint256' }],
    type: 'function',
  },
] as const;

async function checkWallet() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 WALLET STATUS CHECK`);
  console.log(`${"=".repeat(80)}\n`);

  console.log(`Wallet: ${WALLET_ADDRESS}\n`);

  // ETH balance
  const ethBalance = await publicClient.getBalance({
    address: WALLET_ADDRESS as `0x${string}`,
  });
  console.log(`💰 ETH Balance: ${formatUnits(ethBalance, 18)} ETH`);

  // SEND balance
  const sendBalance = await publicClient.readContract({
    address: SEND_TOKEN as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [WALLET_ADDRESS as `0x${string}`],
  }) as bigint;
  console.log(`🎯 SEND Balance: ${formatUnits(sendBalance, 18)} SEND`);

  // Allowance to Aerodrome Router
  const allowance = await publicClient.readContract({
    address: SEND_TOKEN as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [WALLET_ADDRESS as `0x${string}`, AERODROME_ROUTER as `0x${string}`],
  }) as bigint;
  console.log(`🔓 Allowance (Aerodrome): ${formatUnits(allowance, 18)} SEND`);

  console.log(`\n${"=".repeat(80)}`);
  console.log(`📊 ANALYSIS:`);
  console.log(`${"=".repeat(80)}\n`);

  if (sendBalance === 0n) {
    console.log(`❌ No SEND tokens in wallet!`);
    console.log(`   This wallet was already emptied.`);
  } else {
    console.log(`✅ Has ${formatUnits(sendBalance, 18)} SEND tokens`);
  }

  if (allowance === 0n) {
    console.log(`⚠️  No allowance set for Aerodrome Router`);
    console.log(`   Approval transaction needed before swap.`);
  } else {
    console.log(`✅ Allowance set: ${formatUnits(allowance, 18)} SEND`);
  }

  if (ethBalance < BigInt(100000000000000)) { // 0.0001 ETH
    console.log(`⚠️  Low ETH balance (${formatUnits(ethBalance, 18)} ETH)`);
    console.log(`   May not be enough for gas.`);
  } else {
    console.log(`✅ Sufficient ETH for gas`);
  }

  console.log(`\n${"=".repeat(80)}\n`);
}

checkWallet().catch(console.error);
