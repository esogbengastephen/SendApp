import { createPublicClient, createWalletClient, http, formatEther, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { generateUserOfframpWallet } from '../lib/offramp-wallet';
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
const MASTER_WALLET_ADDRESS = process.env.OFFRAMP_ADMIN_WALLET_ADDRESS;
const USER_EMAIL = 'esogbengastephen@gmail.com';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

async function recoverETH() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`💰 RECOVERING ETH FROM TEST WALLET`);
  console.log(`${"=".repeat(80)}\n`);

  // Generate test wallet
  const wallet = generateUserOfframpWallet(USER_EMAIL);
  const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);

  console.log(`From (Test Wallet): ${wallet.address}`);
  console.log(`To (Master Wallet): ${MASTER_WALLET_ADDRESS}\n`);

  // Check balance
  const balance = await publicClient.getBalance({ address: wallet.address as `0x${string}` });
  console.log(`Current Balance: ${formatEther(balance)} ETH\n`);

  if (balance === 0n) {
    console.log(`✅ Wallet is already empty!`);
    return;
  }

  // Estimate gas for the transfer
  const gasPrice = await publicClient.getGasPrice();
  const gasLimit = 21000n; // Standard ETH transfer
  const gasCost = gasPrice * gasLimit;

  console.log(`Gas Price: ${formatEther(gasPrice)} ETH`);
  console.log(`Gas Limit: ${gasLimit.toString()}`);
  console.log(`Gas Cost: ${formatEther(gasCost)} ETH\n`);

  // Calculate amount to send (balance - gas cost)
  const amountToSend = balance - gasCost;

  if (amountToSend <= 0n) {
    console.log(`❌ Not enough ETH to cover gas. Need ${formatEther(gasCost)} ETH for gas.`);
    return;
  }

  console.log(`Amount to Send: ${formatEther(amountToSend)} ETH`);
  console.log(`\n🚀 Sending transaction...\n`);

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(RPC_URL),
  });

  try {
    const txHash = await walletClient.sendTransaction({
      to: MASTER_WALLET_ADDRESS as `0x${string}`,
      value: amountToSend,
    });

    console.log(`✅ Transaction sent!`);
    console.log(`TX Hash: ${txHash}`);
    console.log(`BaseScan: https://basescan.org/tx/${txHash}\n`);

    console.log(`⏳ Waiting for confirmation...`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === 'success') {
      console.log(`\n✅ ETH RECOVERED SUCCESSFULLY!`);
      console.log(`Amount: ${formatEther(amountToSend)} ETH`);
      console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
    } else {
      console.log(`\n❌ Transaction failed`);
    }

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message);
  }

  console.log(`\n${"=".repeat(80)}\n`);
}

recoverETH().catch(console.error);
