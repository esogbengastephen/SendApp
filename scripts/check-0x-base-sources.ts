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

async function check0xBaseSources() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 CHECKING 0x LIQUIDITY SOURCES ON BASE`);
  console.log(`${"=".repeat(80)}\n`);

  try {
    // Query sources endpoint
    const response = await axios.get('https://api.0x.org/swap/v1/sources', {
      params: {
        chainId: 8453, // Base
      },
      headers: {
        '0x-api-key': ZEROX_API_KEY,
      },
    });

    console.log(`✅ Available DEX Sources on Base:\n`);
    
    const sources = response.data.sources || response.data;
    const sourceNames = Object.keys(sources).sort();
    
    let aerodromeFound = false;
    
    sourceNames.forEach((name: string) => {
      console.log(`  - ${name}`);
      if (name.toLowerCase().includes('aerodrome') || name.toLowerCase().includes('aero')) {
        aerodromeFound = true;
      }
    });

    console.log(`\n${"─".repeat(80)}`);
    
    if (aerodromeFound) {
      console.log(`\n✅ Aerodrome IS available in 0x!`);
    } else {
      console.log(`\n❌ Aerodrome is NOT available in 0x sources!`);
      console.log(`\n💡 This is why we need to integrate Aerodrome directly.`);
      console.log(`   0x cannot access Aerodrome's liquidity for SEND token.`);
    }

  } catch (error: any) {
    console.error(`\n❌ Error querying 0x sources:`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${error.response.data?.message || error.response.statusText}`);
    } else {
      console.error(error.message);
    }
  }

  console.log(`\n${"=".repeat(80)}\n`);
}

check0xBaseSources().catch(console.error);
