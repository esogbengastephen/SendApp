/**
 * Send test SEND tokens from receiver wallet to test wallet
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

import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const TEST_WALLET = "0xEc370c4556da79a25Fdbf90B74108b997CADeD63";
const AMOUNT = "5"; // 5 SEND tokens

const ERC20_ABI = [
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function sendTestTokens() {
  console.log(`\n${"#".repeat(80)}`);
  console.log(`🚀 SENDING TEST TOKENS`);
  console.log(`${"#".repeat(80)}\n`);

  const receiverPrivateKey = process.env.OFFRAMP_RECEIVER_WALLET_PRIVATE_KEY;
  
  if (!receiverPrivateKey) {
    console.log(`❌ OFFRAMP_RECEIVER_WALLET_PRIVATE_KEY not found in .env.local`);
    return;
  }

  const account = privateKeyToAccount(receiverPrivateKey as `0x${string}`);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
  });

  console.log(`From: ${account.address}`);
  console.log(`To:   ${TEST_WALLET}`);
  console.log(`Amount: ${AMOUNT} SEND\n`);

  // Check balance before
  const balanceBefore = await publicClient.readContract({
    address: SEND_TOKEN as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });

  console.log(`Balance before: ${formatUnits(balanceBefore, 18)} SEND`);

  if (balanceBefore < parseUnits(AMOUNT, 18)) {
    console.log(`\n❌ Insufficient balance!`);
    return;
  }

  console.log(`\n⏳ Sending ${AMOUNT} SEND tokens...`);

  try {
    const hash = await walletClient.writeContract({
      address: SEND_TOKEN as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [TEST_WALLET as `0x${string}`, parseUnits(AMOUNT, 18)],
    });

    console.log(`\n📝 Transaction hash: ${hash}`);
    console.log(`⏳ Waiting for confirmation...`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log(`\n✅ SUCCESS! Tokens sent!`);
      console.log(`\nBlock: ${receipt.blockNumber}`);
      console.log(`Gas used: ${receipt.gasUsed.toString()}`);

      // Check balance after
      const balanceAfter = await publicClient.readContract({
        address: SEND_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [TEST_WALLET as `0x${string}`],
      });

      console.log(`\n${"=".repeat(80)}`);
      console.log(`✅ TEST WALLET NOW HAS: ${formatUnits(balanceAfter, 18)} SEND`);
      console.log(`${"=".repeat(80)}\n`);

      console.log(`🎉 Ready to test gasless swap!\n`);
      console.log(`Run the swap:`);
      console.log(`\ncurl -X POST http://localhost:3000/api/offramp/swap-token \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{"transactionId":"offramp_5xXSFS-w56w-"}'`);
      console.log(``);
      console.log(`Or run: npx tsx scripts/trigger-swap-test.ts\n`);

    } else {
      console.log(`\n❌ Transaction failed!`);
    }

  } catch (error: any) {
    console.log(`\n❌ Error: ${error.message}`);
  }

  console.log(`\n${"#".repeat(80)}\n`);
}

sendTestTokens().catch(console.error);
