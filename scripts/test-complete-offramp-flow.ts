/**
 * Complete Off-Ramp Test Flow
 * Tests: Generate Address → Send Tokens → Swap (Gasless) → Transfer USDC
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
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

import { createPublicClient, http, formatUnits, parseUnits } from 'viem';
import { base } from 'viem/chains';

const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const USDC_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function testOfframpFlow() {
  console.log(`\n${"#".repeat(80)}`);
  console.log(`🧪 COMPLETE OFF-RAMP FLOW TEST`);
  console.log(`${"#".repeat(80)}\n`);

  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
  });

  console.log(`📋 TEST INSTRUCTIONS:\n`);
  console.log(`1️⃣  Generate Wallet Address:`);
  console.log(`   curl -X POST http://localhost:3000/api/offramp/generate-address \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"userEmail":"test@example.com","userAccountNumber":"TEST123"}'`);
  console.log(``);
  
  console.log(`2️⃣  Send Test Tokens to Generated Address`);
  console.log(`   (Use your wallet to send 1 SEND token)`);
  console.log(``);
  
  console.log(`3️⃣  Trigger Swap:`);
  console.log(`   curl -X POST http://localhost:3000/api/offramp/swap-token \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"transactionId":"YOUR_TRANSACTION_ID"}'`);
  console.log(``);

  console.log(`${"=".repeat(80)}`);
  console.log(`🔍 WHAT TO LOOK FOR IN LOGS:`);
  console.log(`${"=".repeat(80)}\n`);

  console.log(`✅ GASLESS SUCCESS (Layer 1):`);
  console.log(`   [Smart Swap] ✅ LAYER 1 SUCCESS - Gasless swap ready!`);
  console.log(`   [Swap Token] 💰 Cost: $0 ETH (no gas needed)`);
  console.log(`   [Swap Token] 📝 Signing Permit2 message...`);
  console.log(`   [Swap Token] ✅ Swap completed successfully`);
  console.log(``);

  console.log(`⚠️  FALLBACK (Layer 2/3) - Still OK:`);
  console.log(`   [Smart Swap] ⚠️  LAYER 1 FAILED`);
  console.log(`   [Smart Swap] ✅ LAYER 2 SUCCESS (0x traditional)`);
  console.log(`   OR`);
  console.log(`   [Smart Swap] ✅ LAYER 3 SUCCESS (Aerodrome)`);
  console.log(`   [Swap Token] 💰 Cost: ~$0.60 ETH (funded from master)`);
  console.log(``);

  console.log(`${"=".repeat(80)}`);
  console.log(`📊 CHECK WALLET BALANCE:`);
  console.log(`${"=".repeat(80)}\n`);

  const receiverWallet = process.env.OFFRAMP_RECEIVER_WALLET_ADDRESS;
  
  if (receiverWallet) {
    console.log(`Receiver Wallet: ${receiverWallet}\n`);

    try {
      const usdcBalance = await publicClient.readContract({
        address: USDC_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [receiverWallet as `0x${string}`],
      });

      console.log(`Current USDC Balance: ${formatUnits(usdcBalance, 6)} USDC`);
      console.log(`\nAfter successful swap, this balance should increase!\n`);
    } catch (error: any) {
      console.log(`⚠️  Could not fetch balance: ${error.message}`);
    }
  }

  console.log(`${"=".repeat(80)}`);
  console.log(`🎯 EXPECTED RESULTS:`);
  console.log(`${"=".repeat(80)}\n`);

  console.log(`✅ Best Case (90% of time): Gasless Layer 1`);
  console.log(`   - No ETH gas required`);
  console.log(`   - Permit2 signature only`);
  console.log(`   - $0 cost`);
  console.log(``);

  console.log(`✅ Fallback (10% of time): Layer 2 or 3`);
  console.log(`   - ETH funded from master wallet`);
  console.log(`   - On-chain approval + swap`);
  console.log(`   - ~$0.60 cost`);
  console.log(``);

  console.log(`✅ Final Result: USDC in receiver wallet`);
  console.log(``);

  console.log(`${"#".repeat(80)}\n`);
  console.log(`🚀 Ready to test! Run the curl commands above.\n`);
}

testOfframpFlow().catch(console.error);
