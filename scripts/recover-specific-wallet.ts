/**
 * Recover all tokens from specific wallet 0x9317ff359B6Ef71cD945cA791691e8806815b8d9
 * to receiver wallet 0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0
 */

import * as fs from 'fs';
import * as path from 'path';

// Load environment variables FIRST before any other imports
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

// Now import after env is loaded
import { createClient } from '@supabase/supabase-js';
import { createPublicClient, createWalletClient, http, formatUnits, parseEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { generateUserOfframpWallet, generateOfframpWallet } from '../lib/offramp-wallet';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
const SOURCE_WALLET = '0x9317ff359B6Ef71cD945cA791691e8806815b8d9';
const RECEIVER_WALLET = '0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
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

async function findPrivateKey(walletAddress: string): Promise<string | null> {
  console.log(`\n🔑 Finding private key for ${walletAddress}...`);
  
  // Try known identifiers from backup
  const knownIdentifiers = [
    '8f410814-342d-4556-ab15-d74360e28a2e', // user_id from backup
    'esogbengastephen@gmail.com', // user_email from backup
  ];

  for (const identifier of knownIdentifiers) {
    try {
      const wallet = generateUserOfframpWallet(identifier);
      if (wallet.address.toLowerCase() === walletAddress.toLowerCase()) {
        console.log(`   ✅ Derived using identifier: ${identifier}`);
        return wallet.privateKey;
      }
    } catch (error) {
      // Continue
    }
  }
  
  const { data: transactions } = await supabaseAdmin
    .from('offramp_transactions')
    .select('*')
    .eq('unique_wallet_address', walletAddress.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(10);

  if (transactions && transactions.length > 0) {
    console.log(`   📋 Found ${transactions.length} transaction(s)`);

    for (const tx of transactions) {
      // Try old transaction-based method
      try {
        const oldWallet = generateOfframpWallet(tx.transaction_id);
        if (oldWallet.address.toLowerCase() === walletAddress.toLowerCase()) {
          console.log(`   ✅ Derived using old transaction-based method (tx: ${tx.transaction_id})`);
          return oldWallet.privateKey;
        }
      } catch (error) {
        // Continue
      }

      // Try new user-based method
      try {
        const userIdentifier = tx.user_id || tx.user_email || `guest_${tx.user_account_number}`;
        const newWallet = generateUserOfframpWallet(userIdentifier);
        if (newWallet.address.toLowerCase() === walletAddress.toLowerCase()) {
          console.log(`   ✅ Derived using new user-based method (identifier: ${userIdentifier})`);
          return newWallet.privateKey;
        }
      } catch (error) {
        // Continue
      }
    }
  }

  console.log(`   ❌ Could not derive private key`);
  return null;
}

async function recoverTokens() {
  console.log('\n' + '='.repeat(80));
  console.log('🔄 RECOVERING TOKENS FROM WALLET');
  console.log('='.repeat(80) + '\n');
  console.log(`Source Wallet: ${SOURCE_WALLET}`);
  console.log(`Receiver Wallet: ${RECEIVER_WALLET}\n`);

  // Find private key
  const privateKey = await findPrivateKey(SOURCE_WALLET);
  if (!privateKey) {
    console.error('❌ Could not find private key for source wallet');
    process.exit(1);
  }

  // Create wallet client
  const walletClient = createWalletClient({
    chain: base,
    transport: http(RPC_URL),
    account: privateKeyToAccount(privateKey as `0x${string}`),
  });

  // Check ETH balance
  const ethBalance = await publicClient.getBalance({
    address: SOURCE_WALLET as `0x${string}`,
  });

  console.log(`💰 ETH Balance: ${formatUnits(ethBalance, 18)} ETH\n`);

  // Check and transfer ERC20 tokens
  const tokensToCheck = [
    { address: '0xEab49138BA2Ea6dd776220fE26b7b8E446638956', symbol: 'SEND' },
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC' },
    { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI' },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH' },
  ];

  let totalRecovered = 0;

  for (const token of tokensToCheck) {
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

        const txHash = await walletClient.writeContract({
          address: token.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [RECEIVER_WALLET as `0x${string}`, balance],
        });

        console.log(`   ✅ TX Hash: ${txHash}`);
        console.log(`   📊 BaseScan: https://basescan.org/tx/${txHash}\n`);
        totalRecovered++;
      }
    } catch (error: any) {
      console.error(`❌ Error transferring ${token.symbol}:`, error.message);
    }
  }

  // Transfer remaining ETH (leave small amount for gas if needed)
  if (ethBalance > parseFloat('0.0001') * 1e18) {
    const amountToTransfer = ethBalance - BigInt('100000000000000'); // Leave 0.0001 ETH
    if (amountToTransfer > 0n) {
      console.log(`📤 Transferring ${formatUnits(amountToTransfer, 18)} ETH...`);
      try {
        const txHash = await walletClient.sendTransaction({
          to: RECEIVER_WALLET as `0x${string}`,
          value: amountToTransfer,
        });
        console.log(`   ✅ TX Hash: ${txHash}`);
        console.log(`   📊 BaseScan: https://basescan.org/tx/${txHash}\n`);
        totalRecovered++;
      } catch (error: any) {
        console.error(`❌ Error transferring ETH:`, error.message);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ RECOVERY COMPLETE!');
  console.log('='.repeat(80));
  console.log(`📊 Total transfers: ${totalRecovered}`);
  console.log('='.repeat(80) + '\n');
}

recoverTokens().catch(console.error);
