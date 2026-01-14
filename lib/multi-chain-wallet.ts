/**
 * Multi-chain wallet utilities
 * Helper functions for working with multi-chain wallets
 */

import { SUPPORTED_CHAINS, ChainConfig } from "./chains";
import { WalletData, getAddressForChain } from "./wallet";

export interface ChainBalance {
  chainId: string;
  chainName: string;
  address: string;
  balance: string;
  nativeCurrency: string;
}

/**
 * Get all wallet addresses for a user
 */
export function getAllWalletAddresses(walletData: WalletData): Record<string, string> {
  return walletData.addresses;
}

/**
 * Get address for a specific chain
 */
export function getWalletAddress(
  walletData: WalletData,
  chainId: string
): string | null {
  return getAddressForChain(walletData, chainId) || null;
}

/**
 * Validate address format for a specific chain
 */
export function validateAddressForChain(
  address: string,
  chainId: string
): boolean {
  const chainConfig = SUPPORTED_CHAINS[chainId];
  if (!chainConfig) return false;

  if (chainConfig.type === "EVM") {
    // EVM addresses: 0x followed by 40 hex characters
    return /^0x[a-fA-F0-9]{40}$/i.test(address);
  } else if (chainId === "bitcoin") {
    // Bitcoin native segwit addresses: Bech32 format (starts with bc1)
    return /^bc1[a-z0-9]{39,59}$/i.test(address);
  } else if (chainId === "solana") {
    // Solana addresses: Base58, 32-44 characters
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  } else if (chainId === "sui") {
    // Sui addresses: Base58, 32 characters
    return /^0x[a-fA-F0-9]{64}$/.test(address);
  }

  return false;
}

/**
 * Get chain configuration for display
 */
export function getChainDisplayInfo(chainId: string): {
  name: string;
  symbol: string;
  explorerUrl?: string;
} | null {
  const chain = SUPPORTED_CHAINS[chainId];
  if (!chain) return null;

  return {
    name: chain.name,
    symbol: chain.nativeCurrency?.symbol || "",
    explorerUrl: chain.explorerUrl,
  };
}

/**
 * Format address for display (truncate middle)
 */
export function formatAddressForDisplay(
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string {
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Get explorer URL for a transaction
 */
export function getExplorerUrl(
  chainId: string,
  txHash: string
): string | null {
  const chain = SUPPORTED_CHAINS[chainId];
  if (!chain || !chain.explorerUrl) return null;
  return `${chain.explorerUrl}/tx/${txHash}`;
}

/**
 * Get explorer URL for an address
 */
export function getAddressExplorerUrl(
  chainId: string,
  address: string
): string | null {
  const chain = SUPPORTED_CHAINS[chainId];
  if (!chain || !chain.explorerUrl) return null;
  return `${chain.explorerUrl}/address/${address}`;
}

