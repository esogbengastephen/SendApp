#!/usr/bin/env npx tsx
/**
 * Regenerate off-ramp deposit address for flippayhq@gmail.com and update pending transaction.
 * Usage: npx tsx scripts/regenerate-offramp-address.ts
 *
 * Uses non-CDP path: derives new address from user's owner key with nonce 1 (different from nonce 0).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createPublicClient, http, pad } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createClient } from "@supabase/supabase-js";
import { decryptWalletPrivateKey } from "../lib/coinbase-smart-wallet";
import { BASE_RPC_URL } from "../lib/constants";
import { createRpcFetchWith429Retry } from "../lib/rpc-fetch";

const userId = "59786a4c-4cbe-4213-8616-19e7641a86f7";
const transactionId = "DgzMlo567kde0bVe5LXd9";

const COINBASE_FACTORY_1_1 = "0xba5ed110efdba3d005bfc882d75358acbbb85842" as const;
const FACTORY_GET_ADDRESS_ABI = [
  { inputs: [{ name: "owners", type: "bytes[]" }, { name: "nonce", type: "uint256" }], name: "getAddress", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
] as const;

async function getAddressWithNonce(ownerKey: string, nonce: number): Promise<string> {
  const raw = ownerKey.trim().replace(/^0x/, "");
  const key = (`0x${raw}`) as `0x${string}`;
  const ownerAccount = privateKeyToAccount(key);
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL, { fetchFn: createRpcFetchWith429Retry(), retryCount: 2 }),
  });
  const ownersBytes = [pad(ownerAccount.address as `0x${string}`, { size: 32 })];
  return publicClient.readContract({
    address: COINBASE_FACTORY_1_1 as `0x${string}`,
    abi: FACTORY_GET_ADDRESS_ABI,
    functionName: "getAddress",
    args: [ownersBytes, BigInt(nonce)],
  });
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase credentials required (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("id, smart_wallet_owner_encrypted")
    .eq("id", userId)
    .single();

  if (userErr || !user?.smart_wallet_owner_encrypted) {
    console.error("User or smart_wallet_owner_encrypted not found. User must have completed off-ramp flow before.");
    process.exit(1);
  }

  const ownerKey = await decryptWalletPrivateKey(user.smart_wallet_owner_encrypted, userId);
  const newAddress = await getAddressWithNonce(ownerKey, 1);
  console.log("New deposit address (nonce 1):", newAddress);

  const { error } = await supabase
    .from("offramp_transactions")
    .update({
      deposit_address: newAddress,
      wallet_address: newAddress,
      wallet_identifier: newAddress,
      unique_wallet_address: newAddress,
      smart_wallet_address: newAddress,
      status: "pending",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("transaction_id", transactionId)
    .eq("user_id", userId);

  if (error) {
    console.error("DB update failed:", error);
    process.exit(1);
  }
  console.log("Updated. flippayhq@gmail.com can send SEND to:", newAddress);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
