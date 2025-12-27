import { createClient } from '@supabase/supabase-js';
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

async function analyzeWorkingSwaps() {
  console.log(`\n${"=".repeat(100)}`);
  console.log(`🔍 ANALYZING SUCCESSFUL SWAPS FROM YESTERDAY`);
  console.log(`${"=".repeat(100)}\n`);

  // Get transactions with swap_tx_hash (successful swaps)
  const { data: transactions, error } = await supabaseAdmin
    .from('offramp_transactions')
    .select('*')
    .not('swap_tx_hash', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error || !transactions || transactions.length === 0) {
    console.log('❌ No successful swaps found');
    return;
  }

  for (const tx of transactions) {
    console.log(`\n${"─".repeat(100)}`);
    console.log(`Transaction: ${tx.transaction_id}`);
    console.log(`Date: ${tx.created_at}`);
    console.log(`Swap TX: ${tx.swap_tx_hash}`);
    console.log(`USDC: ${tx.usdc_amount || '0'} (${tx.usdc_amount_raw || '0'} raw)`);
    console.log(`Status: ${tx.status}`);
    
    if (tx.swap_tx_hash) {
      try {
        const receipt = await publicClient.getTransactionReceipt({ 
          hash: tx.swap_tx_hash as `0x${string}` 
        });
        const transaction = await publicClient.getTransaction({
          hash: tx.swap_tx_hash as `0x${string}`
        });

        console.log(`\n📊 Transaction Details:`);
        console.log(`  From: ${transaction.from}`);
        console.log(`  To: ${transaction.to || 'Contract Creation'}`);
        console.log(`  Value: ${transaction.value.toString()} wei`);
        console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
        console.log(`  Status: ${receipt.status}`);
        console.log(`  Block: ${receipt.blockNumber.toString()}`);
        
        // Check which contract was called
        const AERODROME_ROUTER = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43';
        const ZEROX_PROXY = '0x785648669b8e90a75a6a8de682258957f9028462';
        
        if (transaction.to?.toLowerCase() === AERODROME_ROUTER.toLowerCase()) {
          console.log(`  ✅ Used: AERODROME DEX`);
        } else if (transaction.to?.toLowerCase() === ZEROX_PROXY.toLowerCase()) {
          console.log(`  ✅ Used: 0x EXCHANGE PROXY`);
        } else {
          console.log(`  ❓ Used: ${transaction.to}`);
        }

        // Check input data to understand what function was called
        if (transaction.input.length > 10) {
          const functionSelector = transaction.input.slice(0, 10);
          console.log(`  Function Selector: ${functionSelector}`);
          
          // Common selectors
          const selectors: Record<string, string> = {
            '0xcac88ea9': 'swapExactTokensForTokens (Aerodrome)',
            '0x1fff991f': '0x Exchange (transformERC20)',
            '0x415565b0': '0x Exchange (fillOrderRoute)',
          };
          
          if (selectors[functionSelector]) {
            console.log(`  Function: ${selectors[functionSelector]}`);
          }
        }

        console.log(`  BaseScan: https://basescan.org/tx/${tx.swap_tx_hash}`);

      } catch (error: any) {
        console.log(`  ❌ Error fetching transaction: ${error.message}`);
      }
    }
  }

  console.log(`\n${"=".repeat(100)}\n`);
}

analyzeWorkingSwaps().catch(console.error);
