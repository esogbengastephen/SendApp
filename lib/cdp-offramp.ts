/**
 * CDP off-ramp: static smart wallet per user and transfer to offramp pool.
 * Uses CDP API (getOrCreateAccount + getOrCreateSmartAccount) so each user has one
 * static Smart Wallet; sweep = CDP transfer to OFFRAMP_ADMIN_WALLET_ADDRESS with Paymaster.
 */

import { CdpClient } from "@coinbase/cdp-sdk";
import { SEND_TOKEN_ADDRESS } from "./constants";

const OFFRAMP_OWNER_NAME_PREFIX = "offramp-owner-";
const OFFRAMP_SMART_NAME_PREFIX = "offramp-smart-";

function getPaymasterUrl(): string {
  const url = process.env.COINBASE_BUNDLER_RPC_URL?.trim();
  if (!url) {
    throw new Error(
      "Paymaster required for CDP off-ramp sweep. Set COINBASE_BUNDLER_RPC_URL (CDP Paymaster endpoint for Base mainnet)."
    );
  }
  return url;
}

/**
 * Whether CDP credentials are set for off-ramp (static smart wallets + CDP transfer).
 */
export function isCdpOfframpConfigured(): boolean {
  const id = process.env.CDP_API_KEY_ID?.trim();
  const secret = process.env.CDP_API_KEY_SECRET?.trim();
  const walletSecret = process.env.CDP_WALLET_SECRET?.trim();
  return Boolean(id && secret && walletSecret);
}

function getCdpClient(): CdpClient {
  const apiKeyId = process.env.CDP_API_KEY_ID?.trim();
  const apiKeySecret = process.env.CDP_API_KEY_SECRET?.trim();
  const walletSecret = process.env.CDP_WALLET_SECRET?.trim();
  if (!apiKeyId || !apiKeySecret || !walletSecret) {
    throw new Error(
      "CDP off-ramp requires CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET."
    );
  }
  return new CdpClient({
    apiKeyId,
    apiKeySecret,
    walletSecret,
  });
}

/**
 * Get or create the off-ramp owner (server account) and smart account for a user.
 * Returns the smart account address. Same name per user => static wallet.
 */
export async function getOrCreateOfframpSmartWalletAddress(
  userId: string
): Promise<string> {
  const cdp = getCdpClient();
  const ownerName = `${OFFRAMP_OWNER_NAME_PREFIX}${userId}`;
  const smartName = `${OFFRAMP_SMART_NAME_PREFIX}${userId}`;

  const owner = await cdp.evm.getOrCreateAccount({ name: ownerName });
  const smartAccount = await cdp.evm.getOrCreateSmartAccount({
    name: smartName,
    owner,
  });
  return smartAccount.address;
}

/**
 * Transfer SEND from the user's CDP smart wallet to the pool address.
 * Uses Paymaster for gas. Returns tx hash on success.
 */
export async function transferSendToPoolCdp(
  userId: string,
  poolAddress: string,
  amountWei: bigint
): Promise<{ success: true; txHash: string } | { success: false; error: string }> {
  try {
    const cdp = getCdpClient();
    const paymasterUrl = getPaymasterUrl();
    const ownerName = `${OFFRAMP_OWNER_NAME_PREFIX}${userId}`;
    const smartName = `${OFFRAMP_SMART_NAME_PREFIX}${userId}`;

    const owner = await cdp.evm.getOrCreateAccount({ name: ownerName });
    const smartAccount = await cdp.evm.getOrCreateSmartAccount({
      name: smartName,
      owner,
    });

    const baseAccount = await smartAccount.useNetwork("base");
    const { userOpHash } = await baseAccount.transfer({
      to: poolAddress as `0x${string}`,
      amount: amountWei,
      token: SEND_TOKEN_ADDRESS as `0x${string}`,
      paymasterUrl,
    });

    const result = await baseAccount.waitForUserOperation({
      userOpHash,
    });
    if (result.status !== "complete" || !("transactionHash" in result)) {
      return {
        success: false,
        error:
          result.status === "failed"
            ? "CDP user operation failed"
            : "CDP transfer did not return transaction hash",
      };
    }
    const txHash = result.transactionHash;
    console.log(
      `[CDP Offramp] Transferred SEND to pool (paymaster), tx: ${txHash}`
    );
    return { success: true, txHash };
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[CDP Offramp] transferSendToPoolCdp failed:", err);
    return { success: false, error: err };
  }
}
