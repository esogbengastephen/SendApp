import { createPublicClient, http, parseAbiItem } from 'viem';
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

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const SUCCESSFUL_SWAPS = [
  {
    name: 'Transaction #6 (USDC_RECEIVED)',
    txHash: '0xfa67a687f9f069100e85cf81651464c467402e579923d694942c3aab4b08e0a8',
    transactionId: 'offramp_Y81PZ3oLNTjY',
    usdcAmount: '2.128083'
  },
  {
    name: 'Transaction #8 (SWAPPING)',
    txHash: '0xa46c83aa8c49530cabade6c1acc7fdee18b1e51e4e0259f308ec6148a5ff170e',
    transactionId: 'offramp_dx-jR2PcVRl3',
    usdcAmount: '1.080503'
  },
  {
    name: 'Transaction #9 (SWAPPING)',
    txHash: '0x2ff57d7aa2d5641aac6337c9a11a2a0c672c6882caf62f8da0edba3562e37b77',
    transactionId: 'offramp_cuJiQ1nt8-jt',
    usdcAmount: '0.216106'
  }
];

async function analyzeSuccessfulSwap(name: string, txHash: string, transactionId: string, usdcAmount: string) {
  console.log(`\n${"=".repeat(100)}`);
  console.log(`✅ ${name} - ${transactionId}`);
  console.log(`${"=".repeat(100)}\n`);

  console.log(`TX Hash: ${txHash}`);
  console.log(`BaseScan: https://basescan.org/tx/${txHash}`);
  console.log(`USDC Received: ${usdcAmount} USDC\n`);

  try {
    const tx = await publicClient.getTransaction({ hash: txHash as `0x${string}` });
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });

    console.log(`From (Wallet): ${tx.from}`);
    console.log(`To (Contract): ${tx.to}`);
    console.log(`Status: ${receipt.status === 'success' ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`Block: ${receipt.blockNumber.toString()}`);
    
    console.log(`\n📝 Input Data Length: ${tx.input.length} characters`);
    console.log(`Input Data (first 100 chars): ${tx.input.slice(0, 100)}...`);

    // Check if it's Aerodrome Router
    const AERODROME_ROUTER = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43';
    if (tx.to?.toLowerCase() === AERODROME_ROUTER.toLowerCase()) {
      console.log(`\n🎯 CONTRACT: Aerodrome Router (${AERODROME_ROUTER})`);
      console.log(`   This used Aerodrome DEX for the swap!`);
    } else {
      console.log(`\n🎯 CONTRACT: ${tx.to}`);
    }

    // Decode logs to find swap details
    console.log(`\n📊 Transaction Logs: ${receipt.logs.length} events`);
    
    // Look for Transfer events
    const transferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const transfers = receipt.logs.filter(log => log.topics[0] === transferEventSignature);
    
    console.log(`\n💸 Token Transfers: ${transfers.length}`);
    transfers.forEach((transfer, i) => {
      console.log(`   ${i + 1}. Token: ${transfer.address}`);
    });

    console.log(`\n`);

  } catch (error: any) {
    console.error(`❌ Error analyzing transaction:`, error.message);
  }
}

async function main() {
  console.log(`\n${"=".repeat(100)}`);
  console.log(`🔍 ANALYZING SUCCESSFUL SWAPS TO UNDERSTAND WHAT WORKED`);
  console.log(`${"=".repeat(100)}\n`);

  for (const swap of SUCCESSFUL_SWAPS) {
    await analyzeSuccessfulSwap(swap.name, swap.txHash, swap.transactionId, swap.usdcAmount);
  }

  console.log(`${"=".repeat(100)}`);
  console.log(`\n📋 SUMMARY: Check which contract/router was used in successful swaps above.`);
  console.log(`${"=".repeat(100)}\n`);
}

main().catch(console.error);
