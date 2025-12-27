import { createPublicClient, http, formatEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const MASTER_PRIVATE_KEY = "0x4ad77fb017847c51258c59f4c348b179a63d6d225d7857987b57c906c5f10c40";
const BASE_RPC_URL = "https://mainnet.base.org";

async function main() {
  const masterAccount = privateKeyToAccount(MASTER_PRIVATE_KEY as `0x${string}`);
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });
  
  const balance = await publicClient.getBalance({ address: masterAccount.address });
  
  console.log(`\n💰 Master Wallet: ${masterAccount.address}`);
  console.log(`   Balance: ${formatEther(balance)} ETH\n`);
  
  if (balance === 0n) {
    console.log(`❌ Master wallet is empty!`);
    console.log(`   Please fund it with at least 0.001 ETH to continue\n`);
  } else {
    console.log(`✅ Master wallet has funds\n`);
  }
}

main().catch(console.error);
