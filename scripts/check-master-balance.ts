/**
 * Check master wallet balance (where ETH should be recovered)
 */
import { createPublicClient, http, formatEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const BASE_RPC_URL = "https://base.llamarpc.com";
const MASTER_KEY = "0xdd1c5205c271b34bb13ccf01cea87c1bca3add3cc04a4fa21bc1e0ad8d07a85f";

async function main() {
  const account = privateKeyToAccount(MASTER_KEY as `0x${string}`);
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });

  console.log(`\n🔑 Master Wallet: ${account.address}\n`);
  
  const ethBalance = await publicClient.getBalance({ address: account.address });
  console.log(`💎 ETH Balance: ${formatEther(ethBalance)}\n`);
  console.log('(ETH from offramp wallets should be recovered here)\n');
}

main().catch(console.error);
