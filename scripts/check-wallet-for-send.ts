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

const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
const WALLET = '0x9317ff359B6Ef71cD945cA791691e8806815b8d9';
const SEND_TOKEN = '0xEab49138BA2Ea6dd776220fE26b7b8E446638956';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const erc20Abi = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
] as const;

(async () => {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 CHECKING WALLET FOR SEND TOKENS`);
  console.log(`${"=".repeat(80)}\n`);
  console.log(`Wallet: ${WALLET}\n`);

  // Check ETH
  const ethBalance = await publicClient.getBalance({ address: WALLET as `0x${string}` });
  console.log(`💰 ETH: ${formatUnits(ethBalance, 18)} ETH`);

  // Check SEND
  const sendBalance = await publicClient.readContract({
    address: SEND_TOKEN as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [WALLET as `0x${string}`],
  }) as bigint;
  console.log(`🎯 SEND: ${formatUnits(sendBalance, 18)} SEND\n`);

  if (sendBalance > 0n) {
    console.log(`✅ SEND TOKENS FOUND!`);
    console.log(`   Amount: ${formatUnits(sendBalance, 18)} SEND`);
    console.log(`\n⚠️  ISSUE: System detected ETH instead of SEND tokens!`);
    console.log(`   This means the token detection is not working correctly.`);
  } else {
    console.log(`❌ No SEND tokens found in wallet`);
  }

  console.log(`\n${"=".repeat(80)}\n`);
})();
