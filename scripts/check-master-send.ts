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

import { createPublicClient, http, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";

const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function checkMaster() {
  const masterPrivateKey = process.env.OFFRAMP_MASTER_WALLET_PRIVATE_KEY;
  if (!masterPrivateKey) {
    console.log(`❌ Master wallet key not found`);
    return;
  }

  const account = privateKeyToAccount(masterPrivateKey as `0x${string}`);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  const sendBalance = await publicClient.readContract({
    address: SEND_TOKEN as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });

  console.log(`\nMaster Wallet: ${account.address}`);
  console.log(`SEND Balance: ${formatUnits(sendBalance, 18)}`);

  if (sendBalance > 0n) {
    console.log(`\n✅ Master wallet has SEND tokens!`);
    console.log(`Can send from master → test wallet`);
  } else {
    console.log(`\n⚠️  Master wallet has no SEND tokens.`);
    console.log(`Please send SEND tokens manually.`);
  }
}

checkMaster().catch(console.error);
