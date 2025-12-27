/**
 * Comprehensive Swap Test - See exactly what's happening
 */

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

import { createPublicClient, http, parseUnits, formatUnits } from 'viem';
import { base } from 'viem/chains';

const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const USDC_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TEST_WALLET = "0xEc370c4556da79a25Fdbf90B74108b997CADeD63";

async function comprehensiveTest() {
  console.log(`\n${"#".repeat(80)}`);
  console.log(`🔍 COMPREHENSIVE SWAP TEST`);
  console.log(`${"#".repeat(80)}\n`);

  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  // Step 1: Check balances
  console.log(`Step 1: Checking wallet balances...\n`);
  
  const ERC20_ABI = [{
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  }] as const;

  const sendBalance = await publicClient.readContract({
    address: SEND_TOKEN as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [TEST_WALLET as `0x${string}`],
  });

  console.log(`Test Wallet: ${TEST_WALLET}`);
  console.log(`SEND Balance: ${formatUnits(sendBalance, 18)}\n`);

  if (sendBalance === BigInt(0)) {
    console.log(`❌ No SEND tokens in wallet! Send tokens first.`);
    return;
  }

  // Step 2: Test smart swap routing
  console.log(`Step 2: Testing smart swap routing...\n`);
  
  const { getSmartSwapTransaction } = await import('../lib/smart-swap');
  
  const sellAmount = parseUnits("5", 18).toString();
  
  try {
    const swapResult = await getSmartSwapTransaction(
      SEND_TOKEN,
      USDC_TOKEN,
      sellAmount,
      TEST_WALLET,
      1
    );

    console.log(`\n${"=".repeat(80)}`);
    console.log(`SMART SWAP RESULT`);
    console.log(`${"=".repeat(80)}\n`);

    if (swapResult.success) {
      console.log(`✅ Swap route found!`);
      console.log(`   Provider: ${swapResult.provider}`);
      console.log(`   Layer: ${swapResult.layerUsed}/3`);
      console.log(`   Gas Required: ${swapResult.gasRequired}`);
      console.log(`\n   Transaction data:`);
      console.log(`   - To: ${swapResult.tx.to}`);
      console.log(`   - Value: ${swapResult.tx.value || 0}`);
      console.log(`   - Gas: ${swapResult.tx.gas || 'auto'}`);
      console.log(`   - Data length: ${swapResult.tx.data?.length || 0} chars`);
      
      if (swapResult.provider === '0x-gasless') {
        console.log(`   - Has Permit2: ${swapResult.tx.permit2 ? 'YES' : 'NO'}`);
      }

      console.log(`\n✅ This means the API call to ${swapResult.provider} WORKED!`);
      console.log(`   The issue must be in the EXECUTION phase.`);
      
    } else {
      console.log(`❌ All layers failed!`);
      console.log(`   Error: ${swapResult.error}`);
      console.log(`\n   This means:`);
      console.log(`   - Layer 1 (0x Gasless): FAILED`);
      console.log(`   - Layer 2 (0x Traditional): FAILED`);
      console.log(`   - Layer 3 (Aerodrome): FAILED`);
    }

  } catch (error: any) {
    console.log(`❌ Error during swap routing: ${error.message}`);
    console.log(`\nFull error:`, error);
  }

  console.log(`\n${"#".repeat(80)}\n`);
}

comprehensiveTest().catch(console.error);
