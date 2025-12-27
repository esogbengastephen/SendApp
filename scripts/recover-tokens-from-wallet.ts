/**
 * Recover all tokens from wallet 0x9317ff359B6Ef71cD945cA791691e8806815b8d9
 * to receiver wallet 0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0
 */

import { createPublicClient, createWalletClient, http, formatUnits, parseEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
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
const SOURCE_WALLET = '0x9317ff359B6Ef71cD945cA791691e8806815b8d9';
const RECEIVER_WALLET = '0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0';
const MASTER_PRIVATE_KEY = process.env.OFFRAMP_MASTER_WALLET_PRIVATE_KEY!;

if (!MASTER_PRIVATE_KEY) {
  console.error('❌ OFFRAMP_MASTER_WALLET_PRIVATE_KEY not found in environment');
  process.exit(1);
}

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  chain: base,
  transport: http(RPC_URL),
  account: privateKeyToAccount(MASTER_PRIVATE_KEY as `0x${string}`),
});

const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
] as const;

// Known tokens to check
const TOKENS_TO_CHECK = [
  { address: '0xEab49138BA2Ea6dd776220fE26b7b8E446638956', symbol: 'SEND' },
  { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC' },
  { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI' },
  { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH' },
];

async function recoverTokens() {
  console.log('\n' + '='.repeat(80));
  console.log('🔄 RECOVERING TOKENS FROM WALLET');
  console.log('='.repeat(80) + '\n');
  console.log(`Source Wallet: ${SOURCE_WALLET}`);
  console.log(`Receiver Wallet: ${RECEIVER_WALLET}\n`);

  // Check ETH balance
  const ethBalance = await publicClient.getBalance({
    address: SOURCE_WALLET as `0x${string}`,
  });

  console.log(`💰 ETH Balance: ${formatUnits(ethBalance, 18)} ETH\n`);

  // Check and transfer ERC20 tokens
  for (const token of TOKENS_TO_CHECK) {
    try {
      const balance = await publicClient.readContract({
        address: token.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [SOURCE_WALLET as `0x${string}`],
      }) as bigint;

      if (balance > 0n) {
        const decimals = await publicClient.readContract({
          address: token.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'decimals',
        }) as number;

        const amount = formatUnits(balance, decimals);
        console.log(`📤 Transferring ${amount} ${token.symbol}...`);

        // We need to use the source wallet's private key, not master wallet
        // But we can't access it directly. Let me check if we can derive it.
        // Actually, we need to check the wallet scanner to see how to get the private key.
        // For now, let's just report what needs to be recovered.
        console.log(`   ⚠️  Need private key for ${SOURCE_WALLET} to transfer`);
        console.log(`   Balance: ${amount} ${token.symbol}\n`);
      }
    } catch (error) {
      console.error(`❌ Error checking ${token.symbol}:`, error);
    }
  }

  // For ETH, we can recover if we have the private key
  // But we need the source wallet's private key, not master wallet
  // Let me check the wallet generation to see if we can derive it

  console.log('\n' + '='.repeat(80));
  console.log('📊 RECOVERY SUMMARY');
  console.log('='.repeat(80));
  console.log(`ETH: ${formatUnits(ethBalance, 18)} ETH`);
  console.log('\n⚠️  To complete recovery, we need the private key for the source wallet.');
  console.log('   This wallet was generated from a user identifier.');
  console.log('   We need to find which user identifier was used to generate this wallet.\n');
}

recoverTokens().catch(console.error);
