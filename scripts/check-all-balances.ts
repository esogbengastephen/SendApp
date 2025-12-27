import { createPublicClient, http, formatEther, formatUnits } from 'viem';
import { base } from 'viem/chains';

const TEST_WALLET = "0xEc370c4556da79a25Fdbf90B74108b997CADeD63";
const MASTER_WALLET = "0x0956130B4cec2A32440DF0812bD0639E5E68c680";
const RECEIVER_WALLET = "0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0";
const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const USDC_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

async function checkAll() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`💰 BALANCE CHECK - DID THE SWAP WORK?`);
  console.log(`${"=".repeat(80)}\n`);

  // Test Wallet
  console.log(`📋 TEST WALLET: ${TEST_WALLET}`);
  const testETH = await publicClient.getBalance({ address: TEST_WALLET as `0x${string}` });
  const testSEND = await publicClient.readContract({
    address: SEND_TOKEN as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [TEST_WALLET as `0x${string}`],
  });
  const testUSDC = await publicClient.readContract({
    address: USDC_TOKEN as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [TEST_WALLET as `0x${string}`],
  });
  console.log(`  ETH:  ${formatEther(testETH)} (${testETH.toString()} wei)`);
  console.log(`  SEND: ${formatUnits(testSEND, 18)}`);
  console.log(`  USDC: ${formatUnits(testUSDC, 6)}`);
  console.log(``);

  // Master Wallet
  console.log(`📋 MASTER WALLET: ${MASTER_WALLET}`);
  const masterETH = await publicClient.getBalance({ address: MASTER_WALLET as `0x${string}` });
  console.log(`  ETH:  ${formatEther(masterETH)}`);
  console.log(``);

  // Receiver Wallet
  console.log(`📋 RECEIVER WALLET: ${RECEIVER_WALLET}`);
  const receiverUSDC = await publicClient.readContract({
    address: USDC_TOKEN as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [RECEIVER_WALLET as `0x${string}`],
  });
  console.log(`  USDC: ${formatUnits(receiverUSDC, 6)}`);
  console.log(``);

  console.log(`${"=".repeat(80)}`);
  console.log(`📊 ANALYSIS`);
  console.log(`${"=".repeat(80)}\n`);

  if (testSEND === BigInt(0) && testUSDC > BigInt(0)) {
    console.log(`✅ SUCCESS! Swap completed!`);
    console.log(`   - SEND tokens swapped to USDC`);
    console.log(`   - USDC in test wallet: ${formatUnits(testUSDC, 6)}`);
    
    if (receiverUSDC > BigInt(0)) {
      console.log(`   - USDC transferred to receiver wallet: ${formatUnits(receiverUSDC, 6)}`);
    } else {
      console.log(`   - ⚠️ USDC not yet transferred to receiver wallet`);
    }

    if (testETH < BigInt("100000000000000")) { // < 0.0001 ETH
      console.log(`   - ✅ Remaining ETH recovered to master wallet`);
    } else {
      console.log(`   - ⚠️ Remaining ETH (${formatEther(testETH)}) still in test wallet`);
    }
  } else if (testSEND > BigInt(0) && testUSDC === BigInt(0)) {
    console.log(`❌ SWAP FAILED or NOT EXECUTED`);
    console.log(`   - SEND tokens still in test wallet: ${formatUnits(testSEND, 18)}`);
    console.log(`   - No USDC received`);
    
    if (testETH > BigInt(0)) {
      console.log(`   - ETH remaining: ${formatEther(testETH)}`);
      console.log(`   - ⚠️ Gas fees NOT recovered (ETH still in wallet)`);
    }
  } else {
    console.log(`⚠️  PARTIAL STATE`);
    console.log(`   - SEND: ${formatUnits(testSEND, 18)}`);
    console.log(`   - USDC: ${formatUnits(testUSDC, 6)}`);
    console.log(`   - ETH: ${formatEther(testETH)}`);
  }

  console.log(`\n${"=".repeat(80)}\n`);
}

checkAll().catch(console.error);
