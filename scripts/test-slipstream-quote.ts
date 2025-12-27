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

const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
const SEND_TOKEN = '0xEab49138BA2Ea6dd776220fE26b7b8E446638956';
const USDC_TOKEN = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const WETH = '0x4200000000000000000000000000000000000006';
const AMOUNT = '10000000000000000000'; // 10 SEND

const AERODROME_SLIPSTREAM_ROUTER = '0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5';
const AERODROME_ROUTER = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43';
const FACTORY = '0x420DD381b31aEf6683db6B902084cB0FFECe40Da';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const ROUTER_ABI = [
  {
    name: "getAmountsOut",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { 
        name: "routes", 
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "stable", type: "bool" },
          { name: "factory", type: "address" }
        ]
      }
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }]
  }
] as const;

async function testRouter(routerName: string, routerAddress: string, routes: any[]) {
  console.log(`\n${"─".repeat(80)}`);
  console.log(`Testing ${routerName}: ${routerAddress}`);
  console.log(`${"─".repeat(80)}\n`);

  console.log(`Routes:`, JSON.stringify(routes, null, 2));

  try {
    const amounts = await publicClient.readContract({
      address: routerAddress as `0x${string}`,
      abi: ROUTER_ABI,
      functionName: "getAmountsOut",
      args: [BigInt(AMOUNT), routes],
    }) as bigint[];

    console.log(`\nAmounts:`, amounts.map(a => a.toString()));
    console.log(`Output USDC: ${Number(amounts[amounts.length - 1]) / 1e6} USDC`);
    
    if (amounts[amounts.length - 1] > 0n) {
      console.log(`\n✅ SUCCESS! This route HAS LIQUIDITY!`);
      return true;
    } else {
      console.log(`\n❌ No liquidity (0 output)`);
      return false;
    }
  } catch (error: any) {
    console.log(`\n❌ Error: ${error.message}`);
    return false;
  }
}

async function test() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🧪 TESTING DIFFERENT AERODROME ROUTERS & ROUTES`);
  console.log(`${"=".repeat(80)}\n`);

  console.log(`SEND: ${SEND_TOKEN}`);
  console.log(`USDC: ${USDC_TOKEN}`);
  console.log(`WETH: ${WETH}`);
  console.log(`Amount: 10 SEND\n`);

  // Test 1: Standard Router with SEND → WETH → USDC
  const routes1 = [
    { from: SEND_TOKEN, to: WETH, stable: false, factory: FACTORY },
    { from: WETH, to: USDC_TOKEN, stable: false, factory: FACTORY }
  ];
  await testRouter('Standard V2 Router (SEND → WETH → USDC)', AERODROME_ROUTER, routes1);

  // Test 2: Standard Router with Direct SEND → USDC
  const routes2 = [
    { from: SEND_TOKEN, to: USDC_TOKEN, stable: false, factory: FACTORY }
  ];
  await testRouter('Standard V2 Router (Direct SEND → USDC)', AERODROME_ROUTER, routes2);

  // Test 3: Slipstream Router with SEND → WETH → USDC
  await testRouter('Slipstream CL Router (SEND → WETH → USDC)', AERODROME_SLIPSTREAM_ROUTER, routes1);

  // Test 4: Slipstream Router Direct
  await testRouter('Slipstream CL Router (Direct SEND → USDC)', AERODROME_SLIPSTREAM_ROUTER, routes2);

  console.log(`\n${"=".repeat(80)}\n`);
}

test().catch(console.error);
