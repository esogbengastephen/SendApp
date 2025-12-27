import axios from 'axios';
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

const ZEROX_API_KEY = process.env.ZEROX_API_KEY;

// Common Base tokens
const TOKENS = {
  WETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  cbETH: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
  SEND: '0xEab49138BA2Ea6dd776220fE26b7b8E446638956',
};

async function test0xPair(sellToken: string, buyToken: string, sellAmount: string, takerAddress: string) {
  try {
    const response = await axios.get('https://api.0x.org/swap/permit2/quote', {
      params: {
        sellToken,
        buyToken,
        sellAmount,
        taker: takerAddress,
        slippagePercentage: 0.01,
        chainId: 8453,
      },
      headers: {
        '0x-api-key': ZEROX_API_KEY,
        '0x-version': 'v2',
      },
    });

    const buyAmount = response.data.buyAmount;
    const sources = response.data.sources || [];
    const activeSources = sources.filter((s: any) => s.proportion > 0);
    
    return {
      success: true,
      buyAmount,
      sources: activeSources.map((s: any) => `${s.name} (${(s.proportion * 100).toFixed(1)}%)`).join(', '),
      hasAerodrome: activeSources.some((s: any) => s.name.toLowerCase().includes('aero')),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    };
  }
}

async function testAll() {
  console.log(`\n${"=".repeat(100)}`);
  console.log(`🧪 TESTING 0x WITH COMMON BASE TOKEN PAIRS`);
  console.log(`${"=".repeat(100)}\n`);

  const testWallet = '0x9317ff359B6Ef71cD945cA791691e8806815b8d9';

  const tests = [
    { name: 'WETH → USDC', sell: TOKENS.WETH, buy: TOKENS.USDC, amount: '1000000000000000000' }, // 1 WETH
    { name: 'USDC → WETH', sell: TOKENS.USDC, buy: TOKENS.WETH, amount: '1000000' }, // 1 USDC
    { name: 'DAI → USDC', sell: TOKENS.DAI, buy: TOKENS.USDC, amount: '1000000000000000000' }, // 1 DAI
    { name: 'cbETH → USDC', sell: TOKENS.cbETH, buy: TOKENS.USDC, amount: '1000000000000000000' }, // 1 cbETH
    { name: 'SEND → USDC', sell: TOKENS.SEND, buy: TOKENS.USDC, amount: '10000000000000000000' }, // 10 SEND
    { name: 'SEND → WETH', sell: TOKENS.SEND, buy: TOKENS.WETH, amount: '10000000000000000000' }, // 10 SEND
  ];

  let workingCount = 0;
  let aerodromeCount = 0;

  for (const test of tests) {
    console.log(`${"─".repeat(100)}`);
    console.log(`Testing: ${test.name}`);
    console.log(`${"─".repeat(100)}`);

    const result = await test0xPair(test.sell, test.buy, test.amount, testWallet);

    if (result.success) {
      console.log(`✅ SUCCESS`);
      console.log(`   Buy Amount: ${result.buyAmount}`);
      console.log(`   Sources: ${result.sources || 'None'}`);
      if (result.hasAerodrome) {
        console.log(`   🎯 Uses Aerodrome: YES`);
        aerodromeCount++;
      } else {
        console.log(`   Uses Aerodrome: No`);
      }
      workingCount++;
    } else {
      console.log(`❌ FAILED`);
      console.log(`   Error: ${result.error}`);
      console.log(`   Status: ${result.status || 'Unknown'}`);
    }
    console.log('');
  }

  console.log(`${"=".repeat(100)}`);
  console.log(`\n📊 RESULTS SUMMARY:\n`);
  console.log(`   Total Tests: ${tests.length}`);
  console.log(`   ✅ Working: ${workingCount}`);
  console.log(`   ❌ Failed: ${tests.length - workingCount}`);
  console.log(`   🎯 Using Aerodrome: ${aerodromeCount}\n`);

  if (workingCount === 0) {
    console.log(`⚠️  WARNING: 0x is NOT working for ANY pairs!`);
    console.log(`   This might be an API key or configuration issue.`);
  } else if (workingCount < tests.length) {
    console.log(`💡 0x works for some tokens but NOT for SEND token.`);
    console.log(`   This is why we need Aerodrome fallback for SEND.`);
  } else {
    console.log(`✅ 0x is working for all token pairs tested!`);
  }

  console.log(`\n${"=".repeat(100)}\n`);
}

testAll().catch(console.error);
