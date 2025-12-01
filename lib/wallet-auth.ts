"use client";

import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { createPublicClient } from "viem";

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [injected()],
  transports: {
    [base.id]: http(),
  },
});

export const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

/**
 * Request wallet connection
 */
export async function connectWallet() {
  try {
    // This will be handled by wagmi hooks in components
    return true;
  } catch (error) {
    console.error("Error connecting wallet:", error);
    throw error;
  }
}

/**
 * Sign message for authentication
 */
export async function signMessage(message: string, address: string) {
  try {
    // This will be handled by wagmi hooks in components
    return "";
  } catch (error) {
    console.error("Error signing message:", error);
    throw error;
  }
}

