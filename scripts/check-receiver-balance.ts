/**
 * Check receiver wallet balance
 */
import { createPublicClient, http, formatUnits, formatEther } from "viem";
import { base } from "viem/chains";

const BASE_RPC_URL = "https://base.llamarpc.com";
const RECEIVER = "0x084DC081e43C8f36e7A8Fa93228b82A40A6673d0";
const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const USDC_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
] as const;

async function main() {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });

  console.log(`\n📬 Receiver Wallet: ${RECEIVER}\n`);
  console.log('💰 Balances:\n');
  
  try {
    // Check ETH
    const ethBalance = await publicClient.getBalance({ address: RECEIVER as `0x${string}` });
    console.log(`  💎 ETH: ${formatEther(ethBalance)}`);
    
    // Check SEND
    const sendBalance = await publicClient.readContract({
      address: SEND_TOKEN as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [RECEIVER as `0x${string}`],
    }) as bigint;
    console.log(`  🎯 SEND: ${formatUnits(sendBalance, 18)}`);
    
    // Check USDC
    const usdcBalance = await publicClient.readContract({
      address: USDC_TOKEN as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [RECEIVER as `0x${string}`],
    }) as bigint;
    console.log(`  💵 USDC: ${formatUnits(usdcBalance, 6)}`);
    
    console.log('\n✅ All offramp wallet tokens should be here\n');
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
  }
}

main().catch(console.error);
