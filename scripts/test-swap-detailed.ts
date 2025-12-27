/**
 * Detailed swap test to diagnose the issue
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

import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { getSmartSwapTransaction } from '../lib/smart-swap';
import { generateUserOfframpWallet } from '../lib/offramp-wallet';

const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const USDC_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TEST_WALLET_ADDRESS = "0xEc370c4556da79a25Fdbf90B74108b997CADeD63";
const USER_IDENTIFIER = "gasless-test@example.com";

async function detailedTest() {
  console.log(`\n${"#".repeat(80)}`);
  console.log(`🔍 DETAILED SWAP TEST`);
  console.log(`${"#".repeat(80)}\n`);

  // Step 1: Generate wallet
  console.log(`Step 1: Generating wallet...`);
  const wallet = generateUserOfframpWallet(USER_IDENTIFIER);
  console.log(`✅ Wallet: ${wallet.address}`);
  console.log(``);

  // Step 2: Get swap transaction
  console.log(`Step 2: Getting swap transaction...`);
  const sellAmount = parseUnits("5", 18).toString();
  
  const swapResult = await getSmartSwapTransaction(
    SEND_TOKEN,
    USDC_TOKEN,
    sellAmount,
    TEST_WALLET_ADDRESS,
    1
  );

  if (!swapResult.success) {
    console.log(`❌ Failed to get swap transaction: ${swapResult.error}`);
    return;
  }

  console.log(`✅ Swap transaction ready!`);
  console.log(`   Provider: ${swapResult.provider}`);
  console.log(`   Layer: ${swapResult.layerUsed}`);
  console.log(`   Gas Required: ${swapResult.gasRequired}`);
  console.log(``);

  // Step 3: Check if gasless
  if (swapResult.provider === '0x-gasless') {
    console.log(`Step 3: Gasless swap detected!`);
    console.log(`   Has Permit2 data: ${swapResult.tx.permit2 ? 'YES' : 'NO'}`);
    
    if (!swapResult.tx.permit2) {
      console.log(`❌ No Permit2 data!`);
      return;
    }

    console.log(`   Permit2 EIP712 data:`, JSON.stringify(swapResult.tx.permit2.eip712, null, 2).substring(0, 200) + '...');
    console.log(``);

    // Step 4: Sign Permit2
    console.log(`Step 4: Signing Permit2 message...`);
    
    const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
    });

    try {
      const signature = await walletClient.signTypedData({
        account: walletClient.account,
        domain: swapResult.tx.permit2.eip712.domain,
        types: swapResult.tx.permit2.eip712.types,
        primaryType: swapResult.tx.permit2.eip712.primaryType,
        message: swapResult.tx.permit2.eip712.message,
      });

      console.log(`✅ Signature: ${signature.substring(0, 20)}...`);
      console.log(``);

      // Step 5: Prepare final transaction
      console.log(`Step 5: Preparing final transaction...`);
      const { concat, numberToHex, size } = await import("viem");
      const signatureLengthInHex = numberToHex(size(signature), {
        signed: false,
        size: 32,
      });

      const finalTransactionData = concat([
        swapResult.tx.data as `0x${string}`,
        signatureLengthInHex as `0x${string}`,
        signature as `0x${string}`
      ]);

      console.log(`✅ Final transaction data length: ${finalTransactionData.length} characters`);
      console.log(`   To: ${swapResult.tx.to}`);
      console.log(`   Value: ${swapResult.tx.value || 0}`);
      console.log(`   Gas: ${swapResult.tx.gas}`);
      console.log(``);

      // Step 6: Check wallet balance
      console.log(`Step 6: Checking wallet ETH balance...`);
      const publicClient = createPublicClient({
        chain: base,
        transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
      });

      const ethBalance = await publicClient.getBalance({
        address: wallet.address as `0x${string}`,
      });

      console.log(`✅ ETH Balance: ${ethBalance.toString()} wei`);
      console.log(``);

      if (ethBalance === BigInt(0)) {
        console.log(`⚠️  WARNING: Wallet has 0 ETH! This will fail.`);
        console.log(`   Even gasless swaps need ETH to submit the transaction.`);
        return;
      }

      // Step 7: Send transaction
      console.log(`Step 7: Sending transaction...`);
      const gasLimit = swapResult.tx.gas ? BigInt(Math.floor(Number(swapResult.tx.gas) * 1.5)) : BigInt(600000);
      
      console.log(`   Using gas limit: ${gasLimit.toString()}`);
      
      const txHash = await walletClient.sendTransaction({
        to: swapResult.tx.to as `0x${string}`,
        data: finalTransactionData,
        value: swapResult.tx.value ? BigInt(swapResult.tx.value) : BigInt(0),
        gas: gasLimit,
      });

      console.log(`✅ Transaction sent: ${txHash}`);
      console.log(`   View on BaseScan: https://basescan.org/tx/${txHash}`);
      console.log(``);

      // Step 8: Wait for receipt
      console.log(`Step 8: Waiting for confirmation...`);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 120_000,
      });

      console.log(`\n${"=".repeat(80)}`);
      console.log(`RESULT`);
      console.log(`${"=".repeat(80)}\n`);
      console.log(`Status: ${receipt.status}`);
      console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
      console.log(`Block: ${receipt.blockNumber.toString()}`);
      console.log(`Transaction Hash: https://basescan.org/tx/${txHash}`);
      
      if (receipt.status === 'success') {
        console.log(`\n🎉 SUCCESS! Gasless swap completed!`);
      } else {
        console.log(`\n❌ FAILED! Transaction reverted on-chain.`);
        console.log(`Check the transaction on BaseScan for more details.`);
      }

    } catch (error: any) {
      console.log(`\n❌ ERROR: ${error.message}`);
      console.log(`\nFull error:`, error);
    }
  } else {
    console.log(`⚠️  Not a gasless swap (provider: ${swapResult.provider})`);
  }

  console.log(`\n${"#".repeat(80)}\n`);
}

detailedTest().catch(console.error);
