/**
 * Recover ETH from CORRECT test wallet (0xEc37...eD63)
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

import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { base } from 'viem/chains';
import { generateUserOfframpWallet } from '../lib/offramp-wallet';

const USER_IDENTIFIER = "gasless-test@example.com";
const MASTER_WALLET_ADDRESS = "0x0956130B4cec2A32440DF0812bD0639E5E68c680";

async function recoverETH() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`💰 RECOVERING ETH FROM TEST WALLET`);
  console.log(`${"=".repeat(80)}\n`);

  // Generate the correct test wallet
  const wallet = generateUserOfframpWallet(USER_IDENTIFIER);
  console.log(`Test Wallet Address: ${wallet.address}`);
  console.log(`(Should be: 0xEc370c4556da79a25Fdbf90B74108b997CADeD63)\n`);

  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  const walletClient = createWalletClient({
    account: wallet,
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  console.log(`To (Master Wallet): ${MASTER_WALLET_ADDRESS}\n`);

  // Check balance
  const balance = await publicClient.getBalance({ address: wallet.address as `0x${string}` });
  console.log(`Test Wallet Balance: ${formatEther(balance)} ETH\n`);

  if (balance === BigInt(0)) {
    console.log(`✅ Wallet already empty. Nothing to recover.`);
    return;
  }

  // Estimate gas
  const gasPrice = await publicClient.getGasPrice();
  const gasLimit = BigInt(21000);
  const gasCost = gasPrice * gasLimit;

  console.log(`Estimated Gas Cost: ${formatEther(gasCost)} ETH\n`);

  // Amount to send
  const amountToSend = balance - gasCost - BigInt("1000000000000"); // Leave tiny buffer

  if (amountToSend <= BigInt(0)) {
    console.log(`⚠️  Balance too low to cover gas.`);
    return;
  }

  console.log(`Recovering: ${formatEther(amountToSend)} ETH\n`);
  console.log(`⏳ Sending transaction...`);

  try {
    const hash = await walletClient.sendTransaction({
      to: MASTER_WALLET_ADDRESS as `0x${string}`,
      value: amountToSend,
    });

    console.log(`\n✅ Transaction sent: ${hash}`);
    console.log(`   View: https://basescan.org/tx/${hash}\n`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log(`✅ SUCCESS! ETH recovered to master wallet.`);
      const finalBalance = await publicClient.getBalance({ address: wallet.address as `0x${string}` });
      console.log(`   Recovered: ${formatEther(balance - finalBalance)} ETH\n`);
    } else {
      console.log(`❌ Transaction failed!`);
    }

  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log(`${"=".repeat(80)}\n`);
}

recoverETH().catch(console.error);
