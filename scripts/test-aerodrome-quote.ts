import { getAerodromeQuote } from '../lib/aerodrome-swap';
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

const SEND_TOKEN = '0xEab49138BA2Ea6dd776220fE26b7b8E446638956';
const USDC_TOKEN = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const AMOUNT = '10000000000000000000'; // 10 SEND

async function test() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🧪 TESTING AERODROME QUOTE FOR SEND → USDC`);
  console.log(`${"=".repeat(80)}\n`);

  console.log(`SEND Token: ${SEND_TOKEN}`);
  console.log(`USDC Token: ${USDC_TOKEN}`);
  console.log(`Amount: ${AMOUNT} (10 SEND)\n`);

  const result = await getAerodromeQuote(SEND_TOKEN, USDC_TOKEN, AMOUNT);

  console.log(`\nResult:`, result);

  if (result.success) {
    console.log(`\n✅ Aerodrome quote SUCCESS!`);
    console.log(`Expected USDC output: ${Number(result.expectedOutput) / 1e6} USDC`);
    console.log(`\n🎯 This means Aerodrome CAN swap SEND → USDC!`);
  } else {
    console.log(`\n❌ Aerodrome quote FAILED`);
    console.log(`Error: ${result.error}`);
  }

  console.log(`\n${"=".repeat(80)}\n`);
}

test().catch(console.error);
