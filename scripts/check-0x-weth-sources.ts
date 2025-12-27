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
const WETH = '0x4200000000000000000000000000000000000006';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const AMOUNT = '1000000000000000000'; // 1 WETH

async function checkWorkingSources() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 CHECKING 0x SOURCES WITH WORKING PAIR (WETH → USDC)`);
  console.log(`${"=".repeat(80)}\n`);

  const url = `https://api.0x.org/swap/v1/quote`;
  
  try {
    console.log(`Querying 0x API for WETH → USDC...\n`);
    
    const response = await axios.get(url, {
      params: {
        chainId: 8453, // Base
        sellToken: WETH,
        buyToken: USDC,
        sellAmount: AMOUNT,
        slippagePercentage: 0.01,
      },
      headers: {
        '0x-api-key': ZEROX_API_KEY,
      },
    });

    console.log(`✅ 0x API Response:\n`);
    console.log(`Buy Amount: ${Number(response.data.buyAmount) / 1e6} USDC`);
    console.log(`Price: ${response.data.price} USDC per WETH\n`);

    // Check sources
    if (response.data.sources) {
      console.log(`${"─".repeat(80)}`);
      console.log(`📊 AVAILABLE DEX SOURCES ON BASE (from this swap):\n`);
      
      let aerodromeFound = false;
      
      response.data.sources.forEach((source: any) => {
        const percentage = (source.proportion * 100).toFixed(2);
        const marker = source.proportion > 0 ? '✅' : '  ';
        console.log(`${marker} ${source.name}: ${percentage}%`);
        
        if (source.name.toLowerCase().includes('aerodrome') || 
            source.name.toLowerCase().includes('aero')) {
          aerodromeFound = true;
        }
      });

      console.log(`\n${"─".repeat(80)}`);
      
      if (aerodromeFound) {
        console.log(`\n✅ AERODROME IS AVAILABLE in 0x on Base!`);
        console.log(`\n💡 But it's NOT being used for SEND token (no liquidity for SEND/USDC).`);
      } else {
        console.log(`\n❌ AERODROME IS NOT in 0x's sources on Base!`);
        console.log(`\n💡 This is why we need direct Aerodrome integration.`);
        console.log(`   0x only has: Uniswap, Sushiswap, Curve, etc.`);
      }
    }

  } catch (error: any) {
    console.error(`\n❌ Error querying 0x API:`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${error.response.data?.message || error.response.statusText}`);
    } else {
      console.error(error.message);
    }
  }

  console.log(`\n${"=".repeat(80)}\n`);
}

checkWorkingSources().catch(console.error);
