/**
 * CDP Smart Wallet address derivation (Coinbase factory 1.1, nonce 0).
 * Used for off-ramp deposit address and local-only wallet creation without calling CreateWallet API.
 */

import { createPublicClient, http, pad } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { BASE_RPC_URL } from "./constants";
import { createRpcFetchWith429Retry } from "./rpc-fetch";

const COINBASE_FACTORY_1_1 = "0xba5ed110efdba3d005bfc882d75358acbbb85842" as const;
const FACTORY_GET_ADDRESS_ABI = [
  {
    inputs: [
      { name: "owners", type: "bytes[]" },
      { name: "nonce", type: "uint256" },
    ],
    name: "getAddress",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Compute the CDP Smart Wallet (Coinbase factory 1.1, nonce 0) address for an owner key.
 * No Coinbase API call — pure on-chain derivation.
 */
export async function getCDPSmartWalletAddress(ownerPrivateKeyHex: string): Promise<string> {
  const raw = ownerPrivateKeyHex.trim().replace(/^0x/, "");
  const key = (`0x${raw}`) as `0x${string}`;
  const ownerAccount = privateKeyToAccount(key);
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL, { fetch: createRpcFetchWith429Retry(), retryCount: 2 }),
  });
  const ownersBytes = [pad(ownerAccount.address as `0x${string}`, { size: 32 })];
  const address = await publicClient.readContract({
    address: COINBASE_FACTORY_1_1 as `0x${string}`,
    abi: FACTORY_GET_ADDRESS_ABI,
    functionName: "getAddress",
    args: [ownersBytes, BigInt(0)],
  });
  return address;
}
