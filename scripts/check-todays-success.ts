import { createClient } from '@supabase/supabase-js';
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const SUCCESS_TX = '0x428ec32fbe28b6fa21b270c4d6e7008faa511e5c7f55da53a1afa6314c9696bf';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const RECEIVER_WALLET = process.env.OFFRAMP_RECEIVER_WALLET_ADDRESS;

const erc20Abi = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
] as const;

async function checkSuccess() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 CHECKING TODAY'S "SUCCESSFUL" SWAP`);
  console.log(`${"=".repeat(80)}\n`);

  console.log(`TX Hash: ${SUCCESS_TX}`);
  console.log(`BaseScan: https://basescan.org/tx/${SUCCESS_TX}\n`);

  const tx = await publicClient.getTransaction({ hash: SUCCESS_TX as `0x${string}` });
  const receipt = await publicClient.getTransactionReceipt({ hash: SUCCESS_TX as `0x${string}` });

  console.log(`Status: ${receipt.status}`);
  console.log(`To Contract: ${tx.to}`);
  console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
  console.log(`Block: ${receipt.blockNumber.toString()}\n`);

  if (receipt.status === 'success') {
    console.log(`✅ Transaction WAS successful on-chain!`);
    console.log(`This was the AERODROME swap that worked.\n`);
    
    // Check USDC in receiver wallet
    if (RECEIVER_WALLET) {
      const usdcBalance = await publicClient.readContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [RECEIVER_WALLET as `0x${string}`],
      }) as bigint;
      
      console.log(`Receiver Wallet: ${RECEIVER_WALLET}`);
      console.log(`USDC Balance: ${formatUnits(usdcBalance, 6)} USDC\n`);
    }

    // Check database status
    const { data: tx } = await supabaseAdmin
      .from('offramp_transactions')
      .select('*')
      .eq('swap_tx_hash', SUCCESS_TX)
      .single();

    if (tx) {
      console.log(`Database Status: ${tx.status}`);
      console.log(`USDC Amount: ${tx.usdc_amount || 'N/A'}`);
    }
  } else {
    console.log(`❌ Transaction reverted!`);
  }

  console.log(`\n${"=".repeat(80)}\n`);
}

checkSuccess().catch(console.error);
