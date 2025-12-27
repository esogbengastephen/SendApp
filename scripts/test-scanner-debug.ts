/**
 * Debug the wallet scanner to see why it's not finding SEND tokens
 */

import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";

const OFFRAMP_WALLET = "0x6905325f09Bd165C6F983519070979b9F4B232ec";
const SEND_TOKEN = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";

const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
] as const;

async function debugScanner() {
  console.log("🔍 Debug Scanner\n");

  // Try different RPC endpoints
  const rpcEndpoints = [
    process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
    "https://base.llamarpc.com",
    "https://base-mainnet.public.blastapi.io",
  ];

  for (const rpc of rpcEndpoints) {
    console.log(`\n📡 Testing RPC: ${rpc}`);
    
    try {
      const publicClient = createPublicClient({
        chain: base,
        transport: http(rpc, {
          retryCount: 3,
          retryDelay: 1000,
        }),
      });

      // Check SEND balance
      const balance = await publicClient.readContract({
        address: SEND_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [OFFRAMP_WALLET as `0x${string}`],
      });

      console.log(`  Balance (raw): ${balance}`);
      console.log(`  Balance (formatted): ${formatUnits(balance as bigint, 18)} SEND`);

      if (balance > 0n) {
        // Get decimals and symbol
        const decimals = await publicClient.readContract({
          address: SEND_TOKEN as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "decimals",
        });

        const symbol = await publicClient.readContract({
          address: SEND_TOKEN as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "symbol",
        });

        console.log(`  ✅ Decimals: ${decimals}`);
        console.log(`  ✅ Symbol: ${symbol}`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  }
}

debugScanner();
