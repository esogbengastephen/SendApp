/**
 * Check balances of all wallets directly without scanner
 */
import { createPublicClient, http, formatUnits, formatEther } from "viem";
import { base } from "viem/chains";

const BASE_RPC_URL = "https://mainnet.base.org";
const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const USDC_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const WALLETS = [
  "0x6905325f09Bd165C6F983519070979b9F4B232ec",
  "0x20717a8732d3341201fa33a06bbe5ed91dbfdeb2",
  "0xed77e10dd5158ED24c8857E1e7894FBe30D8f88c",
  "0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2",
  "0x522B6B6cE859c5e5e335d504e2B6878aD8f9a884",
  "0xCadCda9Ae9f84B865c18dF5af43E60CaE0b31A52",
  "0x4Ff937F3Cd784F4024A311B195f5007935537DC7",
  "0xFa5d32A62feFD8d6609464EdeFbb68Ecd7a26cC4",
  "0x6a2276395B8C617463f3C1574Cb57E82EcbF0522",
  "0x6459AE03e607E9F1A62De6bC17b6977a9F922679",
];

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

  console.log('\n🔍 Checking balances...\n');
  
  let walletsWithTokens = [];
  
  for (const wallet of WALLETS) {
    console.log(`${wallet}:`);
    
    try {
      // Check ETH
      const ethBalance = await publicClient.getBalance({ address: wallet as `0x${string}` });
      if (ethBalance > 0n) {
        console.log(`  💎 ETH: ${formatEther(ethBalance)}`);
        walletsWithTokens.push(wallet);
      }
      
      // Check SEND
      const sendBalance = await publicClient.readContract({
        address: SEND_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [wallet as `0x${string}`],
      }) as bigint;
      
      if (sendBalance > 0n) {
        console.log(`  🎯 SEND: ${formatUnits(sendBalance, 18)}`);
        walletsWithTokens.push(wallet);
      }
      
      // Check USDC
      const usdcBalance = await publicClient.readContract({
        address: USDC_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [wallet as `0x${string}`],
      }) as bigint;
      
      if (usdcBalance > 0n) {
        console.log(`  💵 USDC: ${formatUnits(usdcBalance, 6)}`);
        walletsWithTokens.push(wallet);
      }
      
      if (ethBalance === 0n && sendBalance === 0n && usdcBalance === 0n) {
        console.log(`  ✅ Empty`);
      }
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message?.substring(0, 50)}`);
    }
    
    console.log();
  }
  
  const uniqueWalletsWithTokens = [...new Set(walletsWithTokens)];
  console.log(`\n📊 Summary: ${uniqueWalletsWithTokens.length} wallets have tokens\n`);
  
  if (uniqueWalletsWithTokens.length > 0) {
    console.log('Wallets with tokens:');
    uniqueWalletsWithTokens.forEach(w => console.log(`  ${w}`));
    console.log();
  }
}

main().catch(console.error);
