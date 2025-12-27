/**
 * Recover wasted ETH from test wallet back to master
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

import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Test wallet that has the stranded ETH
const TEST_WALLET_KEY = "0x477190e3a69f7ee2176631cff9c6100672ecb5a55ca6d4331d2e9fc30a3ddcef"; // Derived from mnemonic + user identifier
const MASTER_WALLET_ADDRESS = "0x0956130B4cec2A32440DF0812bD0639E5E68c680";

async function recoverETH() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`💰 RECOVERING WASTED ETH`);
  console.log(`${"=".repeat(80)}\n`);

  const account = privateKeyToAccount(TEST_WALLET_KEY as `0x${string}`);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  console.log(`From (Test Wallet): ${account.address}`);
  console.log(`To (Master Wallet): ${MASTER_WALLET_ADDRESS}\n`);

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Test Wallet Balance: ${formatEther(balance)} ETH\n`);

  if (balance === BigInt(0)) {
    console.log(`✅ Wallet already empty. Nothing to recover.`);
    return;
  }

  // Estimate gas for transfer
  const gasPrice = await publicClient.getGasPrice();
  const gasLimit = BigInt(21000); // Standard ETH transfer
  const gasCost = gasPrice * gasLimit;

  console.log(`Gas Price: ${formatEther(gasPrice)} ETH (per gas)`);
  console.log(`Gas Limit: ${gasLimit.toString()}`);
  console.log(`Estimated Gas Cost: ${formatEther(gasCost)} ETH\n`);

  // Amount to send (balance - gas cost - small buffer)
  const buffer = parseEther("0.000001"); // Small safety buffer
  const amountToSend = balance - gasCost - buffer;

  if (amountToSend <= BigInt(0)) {
    console.log(`⚠️  Balance too low to cover gas. Need at least ${formatEther(gasCost + buffer)} ETH.`);
    console.log(`   Current balance: ${formatEther(balance)} ETH`);
    return;
  }

  console.log(`Amount to send: ${formatEther(amountToSend)} ETH`);
  console.log(`Remaining in wallet (for gas): ${formatEther(gasCost + buffer)} ETH\n`);

  console.log(`⏳ Sending transaction...`);

  try {
    const hash = await walletClient.sendTransaction({
      to: MASTER_WALLET_ADDRESS as `0x${string}`,
      value: amountToSend,
    });

    console.log(`\n✅ Transaction sent: ${hash}`);
    console.log(`   View: https://basescan.org/tx/${hash}\n`);

    console.log(`⏳ Waiting for confirmation...`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log(`\n✅ SUCCESS! ETH recovered to master wallet.`);
      console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
      console.log(`   Block: ${receipt.blockNumber.toString()}`);
      
      // Check final balance
      const finalBalance = await publicClient.getBalance({ address: account.address });
      console.log(`\n   Test wallet final balance: ${formatEther(finalBalance)} ETH`);
      console.log(`   ✅ Recovered: ${formatEther(balance - finalBalance)} ETH\n`);
    } else {
      console.log(`\n❌ Transaction failed!`);
    }

  } catch (error: any) {
    console.log(`\n❌ Error: ${error.message}`);
  }

  console.log(`${"=".repeat(80)}\n`);
}

recoverETH().catch(console.error);
