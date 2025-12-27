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
const USDC_TOKEN = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const AMOUNT = '10000000000000000000'; // 10 SEND

async function check0xSources() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 CHECKING IF 0x USES AERODROME FOR SEND → USDC`);
  console.log(`${"=".repeat(80)}\n`);

  const url = `https://api.0x.org/swap/v1/quote`;
  
  try {
    console.log(`Querying 0x API for SEND → USDC swap...\n`);
    
    const response = await axios.get(url, {
      params: {
        chainId: 8453, // Base
        sellToken: SEND_TOKEN,
        buyToken: USDC_TOKEN,
        sellAmount: AMOUNT,
        slippagePercentage: 0.01,
      },
      headers: {
        '0x-api-key': ZEROX_API_KEY,
      },
    });

    console.log(`✅ 0x API Response:\n`);
    console.log(`Buy Amount: ${Number(response.data.buyAmount) / 1e6} USDC`);
    console.log(`Price: ${response.data.price}`);
    console.log(`Estimated Gas: ${response.data.estimatedGas}\n`);

    // Check sources
    if (response.data.sources) {
      console.log(`${"─".repeat(80)}`);
      console.log(`📊 LIQUIDITY SOURCES USED:\n`);
      
      let aerodromeFound = false;
      
      response.data.sources.forEach((source: any) => {
        const percentage = (source.proportion * 100).toFixed(2);
        console.log(`  ${source.name}: ${percentage}%`);
        
        if (source.name.toLowerCase().includes('aerodrome') || 
            source.name.toLowerCase().includes('aero')) {
          aerodromeFound = true;
        }
      });

      console.log(`\n${"─".repeat(80)}`);
      
      if (aerodromeFound) {
        console.log(`\n✅ YES! 0x USES AERODROME for SEND swaps!`);
        console.log(`\n💡 This means we can use 0x instead of going direct to Aerodrome.`);
        console.log(`   0x will aggregate Aerodrome with other DEXes for best price.`);
      } else {
        console.log(`\n❌ NO! 0x does NOT use Aerodrome for SEND swaps.`);
        console.log(`\n💡 This is why we need to go directly to Aerodrome for SEND.`);
        console.log(`   0x doesn't have access to Aerodrome's SEND liquidity.`);
      }
    }

    // Check if route information is available
    if (response.data.route) {
      console.log(`\n${"─".repeat(80)}`);
      console.log(`🛣️  SWAP ROUTE:\n`);
      console.log(JSON.stringify(response.data.route, null, 2));
    }

  } catch (error: any) {
    console.error(`\n❌ Error querying 0x API:`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${error.response.data?.message || error.response.statusText}`);
      console.error(`Data:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }

  console.log(`\n${"=".repeat(80)}\n`);
}

check0xSources().catch(console.error);
