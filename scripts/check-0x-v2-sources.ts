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
const SEND_TOKEN = '0xEab49138BA2Ea6dd776220fE26b7b8E446638956';
const WETH = '0x4200000000000000000000000000000000000006';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

async function check0xV2() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 CHECKING 0x API V2 SOURCES`);
  console.log(`${"=".repeat(80)}\n`);

  const tests = [
    { name: 'WETH → USDC', sell: WETH, buy: USDC, amount: '1000000000000000000' },
    { name: 'SEND → USDC', sell: SEND_TOKEN, buy: USDC, amount: '10000000000000000000' },
  ];

  for (const test of tests) {
    console.log(`\n${"─".repeat(80)}`);
    console.log(`Testing: ${test.name}`);
    console.log(`${"─".repeat(80)}\n`);

    try {
      const response = await axios.get('https://api.0x.org/swap/permit2/quote', {
        params: {
          sellToken: test.sell,
          buyToken: test.buy,
          sellAmount: test.amount,
          taker: '0x0000000000000000000000000000000000000000',
          slippagePercentage: 0.01,
          chainId: 8453,
        },
        headers: {
          '0x-api-key': ZEROX_API_KEY,
          '0x-version': 'v2',
        },
      });

      console.log(`✅ Quote received!`);
      console.log(`Buy Amount: ${response.data.buyAmount}`);
      
      if (response.data.sources) {
        console.log(`\n📊 Sources:`);
        response.data.sources.forEach((source: any) => {
          const pct = (source.proportion * 100).toFixed(2);
          if (source.proportion > 0) {
            console.log(`  ✅ ${source.name}: ${pct}%`);
          } else {
            console.log(`     ${source.name}: ${pct}%`);
          }
        });

        const hasAerodrome = response.data.sources.some((s: any) => 
          s.name.toLowerCase().includes('aero')
        );
        
        if (hasAerodrome) {
          console.log(`\n✅ AERODROME FOUND IN SOURCES!`);
        } else {
          console.log(`\n❌ Aerodrome NOT in sources`);
        }
      }

    } catch (error: any) {
      console.log(`❌ Error: ${error.response?.status || error.message}`);
      if (error.response?.data) {
        console.log(`Message: ${JSON.stringify(error.response.data, null, 2)}`);
      }
    }
  }

  console.log(`\n${"=".repeat(80)}\n`);
}

check0xV2().catch(console.error);
